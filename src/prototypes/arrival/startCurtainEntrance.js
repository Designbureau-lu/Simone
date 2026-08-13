import { CurtainEntranceMotion } from "./CurtainEntranceMotion.js";
import {
    CharacterCellReplacement
} from "../identity/CharacterCellReplacement.js";

export const CURTAIN_ENTRANCE_CONFIG = Object.freeze({
    delayProgress: 0.10,
    startingOffsetViewportWidths: 1.10,
    offsetRemainingAtSnap: 0.55,
    snapFlightDuration: 280,
    entranceVisibleFactor: 0.85,
    settlementDuration: 600,
    periodSettlementStagger: 12,
    indexRevealDelay: 200,
    indexCharacterInterval: 10,
    frameDeltaClamp: 32
});

const ENTRANCE = CURTAIN_ENTRANCE_CONFIG;

export function startCurtainEntrance(application) {
    const stage = document.querySelector(".curtain-sticky-stage");
    const presentation = document.getElementById("curtainPresentation");
    const indexLabel = document.querySelector(".curtain-index-label");
    if (!(stage instanceof HTMLElement)
        || !(presentation instanceof HTMLElement)
        || !(indexLabel instanceof HTMLElement)) {
        return;
    }

    let frameId = null;
    let previousTimestamp = null;
    let scrollProgress = entranceScrollProgress(stage);
    const horizontalMotion = new CurtainEntranceMotion({
        initialOffset: ENTRANCE.startingOffsetViewportWidths,
        delayProgress: ENTRANCE.delayProgress,
        offsetRemainingAtSnap: ENTRANCE.offsetRemainingAtSnap,
        snapFlightDuration: ENTRANCE.snapFlightDuration
    });
    let curtainSnapshot = null;
    let snapshotRestored = false;
    let entranceStateApplied = false;
    let horizontalArrivalComplete = false;
    let settlementStartedAt = null;
    let settlementPeriodRange = null;
    let settlementVisibleFactors = null;
    let settlementComplete = false;
    let landed = false;
    let indexRevealStarted = false;
    let indexReplacement = null;
    let indexRevealTimer = null;

    const scheduleFrame = () => {
        if (frameId === null && !landed) {
            frameId = window.requestAnimationFrame(renderFrame);
        }
    };

    const startSnapFlight = () => {
        if (horizontalMotion.snapFollowing || horizontalMotion.complete) {
            return;
        }
        horizontalMotion.beginNativeSnap();
        previousTimestamp = performance.now();
    };

    const updateScrollTarget = () => {
        if (landed) {
            return;
        }
        scrollProgress = entranceScrollProgress(stage);
        if (!horizontalMotion.snapFollowing && scrollProgress >= 1) {
            startSnapFlight();
        } else if (!horizontalMotion.snapFollowing) {
            horizontalMotion.updateScrollProgress(scrollProgress);
        }
        if (scrollProgress >= ENTRANCE.delayProgress) {
            prepareEntranceState();
        }
        scheduleFrame();
    };

    const revealIndex = () => {
        if (indexRevealStarted) {
            return;
        }
        indexRevealStarted = true;
        indexReplacement = revealIndexLabel(indexLabel);
    };

    const prepareEntranceState = () => {
        if (entranceStateApplied) {
            return true;
        }
        const periods = application.curtainField.periods;
        if (periods.length === 0) {
            return false;
        }
        curtainSnapshot = Object.freeze({
            visibleFactors: Object.freeze(periods.map(
                (period) => period.visibleFactor
            )),
            sceneVisibleFactor: application.sceneVisibleFactor
        });
        application.curtainField.setVisibleFactors(
            curtainSnapshot.visibleFactors.map(
                () => ENTRANCE.entranceVisibleFactor
            )
        );
        application.sceneVisibleFactor = ENTRANCE.entranceVisibleFactor;
        application.render();
        entranceStateApplied = true;
        return true;
    };

    const renderFrame = (timestamp) => {
        frameId = null;
        const rawElapsed = previousTimestamp === null
            ? 0
            : timestamp - previousTimestamp;
        const elapsed = Math.min(rawElapsed, ENTRANCE.frameDeltaClamp);
        previousTimestamp = timestamp;
        horizontalMotion.advance(rawElapsed);
        const horizontalJustCompleted = !horizontalArrivalComplete
            && horizontalMotion.complete;
        if (horizontalJustCompleted) {
            horizontalMotion.finish();
            horizontalArrivalComplete = true;
        }
        setPresentationOffset(presentation, horizontalMotion.currentOffset);

        if (curtainSettlementIsReady({
            horizontalJustCompleted,
            curtainSnapshot
        })) {
            settlementStartedAt = timestamp - Math.max(elapsed, 1);
            settlementPeriodRange = visiblePeriodRangeFor(application);
            settlementVisibleFactors = new Array(
                curtainSnapshot.visibleFactors.length
            );
        }

        if (settlementStartedAt !== null && curtainSnapshot) {
            const settlementElapsed = timestamp - settlementStartedAt;
            const completeSettlementDuration = settlementDurationForRange(
                settlementPeriodRange,
                ENTRANCE.settlementDuration,
                ENTRANCE.periodSettlementStagger
            );
            const sceneSettlementProgress = Math.min(
                settlementElapsed / ENTRANCE.settlementDuration,
                1
            );
            if (settlementElapsed >= completeSettlementDuration) {
                restoreSnapshot();
                settlementComplete = true;
            } else {
                applySnapshotProgress(
                    settlementElapsed,
                    easeOutCubic(sceneSettlementProgress)
                );
            }
        }

        if (horizontalArrivalComplete
            && (!curtainSnapshot || settlementComplete)) {
            finishEntrance();
            return;
        }

        if (horizontalMotion.needsAdvance
            || (horizontalArrivalComplete && settlementStartedAt === null)
            || (settlementStartedAt !== null && !settlementComplete)) {
            scheduleFrame();
        }
    };

    const applySnapshotProgress = (elapsed, sceneProgress) => {
        if (!curtainSnapshot
            || !settlementPeriodRange
            || !settlementVisibleFactors) {
            return;
        }
        for (
            let periodIndex = 0;
            periodIndex < settlementVisibleFactors.length;
            periodIndex += 1
        ) {
            const progress = easeOutCubic(staggeredPeriodProgress({
                elapsed,
                periodIndex,
                visibleRange: settlementPeriodRange,
                stagger: ENTRANCE.periodSettlementStagger,
                duration: ENTRANCE.settlementDuration
            }));
            const capturedFactor = curtainSnapshot
                .visibleFactors[periodIndex];
            settlementVisibleFactors[periodIndex] = (
                ENTRANCE.entranceVisibleFactor
                + (capturedFactor - ENTRANCE.entranceVisibleFactor) * progress
            );
        }
        application.curtainField.setVisibleFactors(settlementVisibleFactors);
        application.sceneVisibleFactor = ENTRANCE.entranceVisibleFactor
            + (curtainSnapshot.sceneVisibleFactor
                - ENTRANCE.entranceVisibleFactor) * sceneProgress;
        application.render();
    };

    const restoreSnapshot = () => {
        if (!curtainSnapshot) {
            return;
        }
        restoreCurtainSnapshot(application, curtainSnapshot);
        snapshotRestored = true;
    };

    const finishEntrance = () => {
        if (landed) {
            return;
        }
        if (!snapshotRestored) {
            restoreSnapshot();
        }
        landed = true;
        horizontalMotion.finish();
        presentation.style.removeProperty("transform");
        presentation.removeAttribute("data-entrance-active");
        window.removeEventListener("scroll", updateScrollTarget);
        window.removeEventListener("resize", updateScrollTarget);
        indexRevealTimer = window.setTimeout(() => {
            indexRevealTimer = null;
            revealIndex();
        }, ENTRANCE.indexRevealDelay);
    };

    presentation.dataset.entranceActive = "";
    setPresentationOffset(presentation, horizontalMotion.currentOffset);
    indexLabel.textContent = "";
    window.addEventListener("scroll", updateScrollTarget, { passive: true });
    window.addEventListener("resize", updateScrollTarget);
    updateScrollTarget();
}

export function revealIndexLabel(indexLabel) {
    return new CharacterCellReplacement({
        element: indexLabel,
        source: "     ",
        target: "INDEX",
        interval: ENTRANCE.indexCharacterInterval,
        delay: 0
    });
}

export function curtainSettlementIsReady({
    horizontalJustCompleted,
    curtainSnapshot
}) {
    return horizontalJustCompleted && curtainSnapshot !== null;
}

export function restoreCurtainSnapshot(application, curtainSnapshot) {
    application.curtainField.setVisibleFactors(
        curtainSnapshot.visibleFactors.slice()
    );
    application.sceneVisibleFactor = curtainSnapshot.sceneVisibleFactor;
    application.render();
}

export function visiblePeriodRangeFor(application) {
    const periodCount = application.curtainField.periods.length;
    if (periodCount === 0) {
        return Object.freeze({ first: 0, last: 0 });
    }
    const windowStart = application.viewport.projectedOffset;
    const windowEnd = windowStart + application.viewport.projectedExtent;
    let first = null;
    let last = null;
    for (const projectedColumn of application.projectedColumns) {
        if (!projectedColumn) {
            continue;
        }
        const { placement, width } = projectedColumn;
        const left = Math.min(placement.targetX, placement.targetX + width);
        const right = Math.max(placement.targetX, placement.targetX + width);
        if (right > windowStart && left < windowEnd) {
            first ??= placement.periodIndex;
            last = placement.periodIndex;
        }
    }
    if (first === null || last === null) {
        return Object.freeze({ first: 0, last: periodCount - 1 });
    }
    return Object.freeze({
        first: Math.min(first, last),
        last: Math.max(first, last)
    });
}

export function staggeredPeriodProgress({
    elapsed,
    periodIndex,
    visibleRange,
    stagger,
    duration
}) {
    const clampedPeriodIndex = Math.min(Math.max(
        periodIndex,
        visibleRange.first
    ), visibleRange.last);
    const delay = (clampedPeriodIndex - visibleRange.first) * stagger;
    return Math.min(Math.max((elapsed - delay) / duration, 0), 1);
}

export function settlementDurationForRange(
    visibleRange,
    duration,
    stagger
) {
    return duration
        + (visibleRange.last - visibleRange.first) * stagger;
}

function entranceScrollProgress(stage) {
    const viewportHeight = window.innerHeight;
    if (viewportHeight <= 0) {
        return 0;
    }
    return Math.min(Math.max(
        (viewportHeight - stage.getBoundingClientRect().top) / viewportHeight,
        0
    ), 1);
}

function easeOutCubic(progress) {
    return 1 - (1 - progress) ** 3;
}

function setPresentationOffset(presentation, viewportWidths) {
    presentation.style.transform = `translate3d(${viewportWidths * 100}%,0,0)`;
}
