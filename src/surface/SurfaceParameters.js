/**
 * Owns user-facing visibility parameters and resolves physical geometry values.
 */
export class SurfaceParameters {
    constructor({
        minimumVisibleFactor = 0.2,
        maximumVisibleFactor = 0.9,
        carrierDistance = 100,
        modelTransition = 0.6
    } = {}) {
        this.configure({
            minimumVisibleFactor,
            maximumVisibleFactor,
            carrierDistance,
            modelTransition
        });
    }

    configure({
        minimumVisibleFactor = this.minimumVisibleFactor,
        maximumVisibleFactor = this.maximumVisibleFactor,
        carrierDistance = this.carrierDistance,
        modelTransition = this.modelTransition
    }) {
        validateParameters({
            minimumVisibleFactor,
            maximumVisibleFactor,
            carrierDistance,
            modelTransition
        });

        this.minimumVisibleFactor = minimumVisibleFactor;
        this.maximumVisibleFactor = maximumVisibleFactor;
        this.carrierDistance = carrierDistance;
        this.modelTransition = modelTransition;
    }

    /** Returns the effective parameters consumed by geometry and shading. */
    resolve(visibleFactor) {
        if (!Number.isFinite(visibleFactor)) {
            throw new RangeError("Visible Factor must be finite.");
        }

        const constrainedVisibleFactor = clamp(
            visibleFactor,
            this.minimumVisibleFactor,
            this.maximumVisibleFactor
        );
        const currentPosition = 1 - constrainedVisibleFactor;
        const closedLimit = 1 - this.maximumVisibleFactor;
        const openLimit = 1 - this.minimumVisibleFactor;
        const modelTransition = 1 - this.modelTransition;
        const gatheringProgress = normalizeOperatingPosition(
            currentPosition,
            closedLimit,
            openLimit
        );
        const gathering = resolveGeometryGathering(currentPosition);
        const projectedCarrierSpacing = resolveProjectedCarrierSpacing(
            this.carrierDistance,
            currentPosition
        );
        const foldProgress = resolveFoldProgress(
            constrainedVisibleFactor,
            this.maximumVisibleFactor,
            this.modelTransition
        );

        return Object.freeze({
            minimumVisibleFactor: this.minimumVisibleFactor,
            maximumVisibleFactor: this.maximumVisibleFactor,
            visibleFactor: constrainedVisibleFactor,
            closedLimit,
            openLimit,
            currentPosition,
            gathering,
            carrierDistance: this.carrierDistance,
            projectedCarrierSpacing,
            foldProgress,
            modelTransition,
            gatheringProgress,
            transitionStart: modelTransition,
            transitionEnd: modelTransition,
            profileShape: resolveProfileShape(gatheringProgress, modelTransition),
            contactedNarrowing: resolveContactedNarrowing(
                gatheringProgress,
                modelTransition
            )
        });
    }

}

function resolveFoldProgress(
    visibleFactor,
    maximumVisibleFactor,
    modelTransition
) {
    if (modelTransition >= maximumVisibleFactor) {
        return visibleFactor <= modelTransition ? 1 : 0;
    }

    return clamp(
        (maximumVisibleFactor - visibleFactor)
            / (maximumVisibleFactor - modelTransition),
        0,
        1
    );
}

function validateParameters(parameters) {
    const { minimumVisibleFactor, maximumVisibleFactor } = parameters;

    if (!Number.isFinite(minimumVisibleFactor)
        || minimumVisibleFactor < 0
        || minimumVisibleFactor > 1) {
        throw new RangeError("Minimum Visible Factor must be between 0 and 1.");
    }

    if (!Number.isFinite(maximumVisibleFactor)
        || maximumVisibleFactor < minimumVisibleFactor
        || maximumVisibleFactor > 1) {
        throw new RangeError(
            "Maximum Visible Factor must be between the minimum factor and 1."
        );
    }

    if (!Number.isFinite(parameters.carrierDistance) || parameters.carrierDistance <= 0) {
        throw new RangeError("Carrier distance must be a positive finite number.");
    }

    if (!Number.isFinite(parameters.modelTransition)
        || parameters.modelTransition < 0
        || parameters.modelTransition > 1) {
        throw new RangeError("Model transition must be between 0 and 1.");
    }
}

function normalizeOperatingPosition(current, closed, open) {
    if (open === closed) {
        return 0;
    }

    return clamp((current - closed) / (open - closed), 0, 1);
}

/** Makes projected artwork width equal the physical opening fraction. */
function resolveGeometryGathering(currentPosition) {
    return 1 / currentPosition;
}

/** Projects fixed fully-open carrier spacing into the current curtain width. */
function resolveProjectedCarrierSpacing(carrierDistance, currentPosition) {
    const millimetresPerPixel = 1;
    const openingFactor = 1 - currentPosition;
    const projectedMillimetres = carrierDistance * openingFactor;

    return projectedMillimetres / millimetresPerPixel;
}

function resolveProfileShape(gatheringProgress, transitionEnd) {
    return smoothstep(progressBetween(gatheringProgress, 0, transitionEnd));
}

function resolveContactedNarrowing(gatheringProgress, transitionEnd) {
    if (transitionEnd >= 1) {
        return 0;
    }

    return smoothstep(progressBetween(gatheringProgress, transitionEnd, 1));
}

function progressBetween(value, start, end) {
    if (end <= start) {
        return value < end ? 0 : 1;
    }

    return clamp((value - start) / (end - start), 0, 1);
}

function smoothstep(value) {
    return value ** 2 * (3 - 2 * value);
}

function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), maximum);
}
