// A linear influence ramp affects the nearest CONCERNED_NEIGHBORS neighboring periods.
const CONCERNED_NEIGHBORS = 50;
const GRABBED_PERIOD_PARTICIPATION = 0.08;

/** Mutable local state for one geometric curtain period. */
export class Period {
    constructor(visibleFactor) {
        this.setVisibleFactor(visibleFactor);
    }

    setVisibleFactor(visibleFactor) {
        validateVisibleFactor(visibleFactor);
        this.visibleFactor = visibleFactor;
    }
}

/** Owns the ordered runtime state of all geometric periods. */
export class CurtainField {
    #periods = Object.freeze([]);
    #resolvedParameters = Object.freeze([]);
    #resetCurtainState;
    #periodLength = null;

    constructor({ resetCurtainState = 0.5 } = {}) {
        this.#resetCurtainState = resetCurtainState;
        validateVisibleFactor(resetCurtainState);
    }

    get periods() {
        return this.#periods;
    }

    get resetCurtainState() {
        return this.#resetCurtainState;
    }

    configureFor(artworkWidth, periodLength) {
        validatePositiveNumber(artworkWidth, "Artwork width");
        validatePositiveNumber(periodLength, "Period length");

        const periodCount = Math.ceil(artworkWidth / periodLength);
        if (periodCount === this.#periods.length
            && periodLength === this.#periodLength) {
            return;
        }

        this.#periodLength = periodLength;
        this.#periods = Object.freeze(Array.from(
            { length: periodCount },
            () => new Period(this.#resetCurtainState)
        ));
        this.#resolvedParameters = Object.freeze([]);
    }

    setResetCurtainState(resetCurtainState) {
        validateVisibleFactor(resetCurtainState);
        this.#resetCurtainState = resetCurtainState;

        for (const period of this.#periods) {
            period.setVisibleFactor(resetCurtainState);
        }
    }

    setResetCurtainStateTarget(resetCurtainState) {
        validateVisibleFactor(resetCurtainState);
        this.#resetCurtainState = resetCurtainState;
    }

    setVisibleFactors(visibleFactors) {
        if (!Array.isArray(visibleFactors)
            || visibleFactors.length !== this.#periods.length) {
            throw new RangeError(
                "Visible Factors must match the Curtain Period count."
            );
        }

        for (let index = 0; index < this.#periods.length; index += 1) {
            this.#periods[index].setVisibleFactor(visibleFactors[index]);
        }
    }

    setVisibleFactorRange(startIndex, endIndex, visibleFactor) {
        validateVisibleFactor(visibleFactor);
        if (!Number.isInteger(startIndex)
            || !Number.isInteger(endIndex)
            || startIndex < 0
            || endIndex < startIndex
            || endIndex >= this.#periods.length) {
            throw new RangeError("Visible Factor range is outside the curtain.");
        }

        for (let index = startIndex; index <= endIndex; index += 1) {
            this.#periods[index].setVisibleFactor(visibleFactor);
        }
    }

    beginLocalInteraction(projectedX) {
        if (!Number.isFinite(projectedX)) {
            throw new RangeError("Projected interaction position must be finite.");
        }

        const location = this.#periodAt(projectedX);
        const periodIndex = location.periodIndex;
        const localPosition = location.width === 0
            ? 0.5
            : clamp(
                (projectedX - location.leftEdge) / location.width,
                0,
                1
            );

        return Object.freeze({
            periodIndex,
            localPosition,
            leftInfluence: influenceTotalFor(
                periodIndex,
                -1,
                this.#periods.length
            ),
            rightInfluence: influenceTotalFor(
                periodIndex,
                1,
                this.#periods.length
            ),
            visibleFactors: Object.freeze(this.#periods.map(
                (period) => period.visibleFactor
            ))
        });
    }

    beginRightwardInteractionAtPeriod(periodIndex) {
        if (!Number.isInteger(periodIndex)
            || periodIndex < 0
            || periodIndex >= this.#periods.length) {
            throw new RangeError("Interaction period is outside the curtain.");
        }

        return Object.freeze({
            periodIndex,
            localPosition: 0,
            leftInfluence: 0,
            rightInfluence: influenceTotalFor(
                periodIndex,
                1,
                this.#periods.length
            ),
            rightwardOnly: true,
            visibleFactors: Object.freeze(this.#periods.map(
                (period) => period.visibleFactor
            ))
        });
    }

    applyLocalDisplacement(
        interaction,
        projectedDisplacement,
        periodLength,
        minimumVisibleFactor,
        maximumVisibleFactor,
        diagnosticLabel = null
    ) {
        const deformation = localDeformationFor(
            interaction,
            projectedDisplacement,
            periodLength,
            this.#periods.length
        );
        const changes = [];

        for (
            let index = deformation.start;
            index <= deformation.end;
            index += 1
        ) {
            const visibleFactor = clamp(
                interaction.visibleFactors[index]
                    + deformation.redistributions[index],
                minimumVisibleFactor,
                maximumVisibleFactor
            );

            this.#periods[index].setVisibleFactor(visibleFactor);
            changes.push(Object.freeze({
                periodIndex: index,
                before: interaction.visibleFactors[index],
                after: visibleFactor
            }));
        }

        logDisplacementChanges(
            diagnosticLabel,
            interaction.periodIndex,
            changes
        );

        return this.#periods[interaction.periodIndex].visibleFactor;
    }

    applyPinchDisplacement(
        firstInteraction,
        firstDisplacement,
        secondInteraction,
        secondDisplacement,
        periodLength,
        minimumVisibleFactor,
        maximumVisibleFactor
    ) {
        const first = localDeformationFor(
            firstInteraction,
            firstDisplacement,
            periodLength,
            this.#periods.length
        );
        const second = localDeformationFor(
            secondInteraction,
            secondDisplacement,
            periodLength,
            this.#periods.length
        );
        const visibleFactors = firstInteraction.visibleFactors.map(
            (visibleFactor, index) => clamp(
                visibleFactor
                    + first.redistributions[index]
                    + second.redistributions[index],
                minimumVisibleFactor,
                maximumVisibleFactor
            )
        );

        this.setVisibleFactors(visibleFactors);
        const centerIndex = Math.round(
            (firstInteraction.periodIndex + secondInteraction.periodIndex) / 2
        );
        return this.#periods[centerIndex].visibleFactor;
    }

    applyTemporaryReveal(
        interaction,
        reveal,
        directionalBias,
        minimumVisibleFactor,
        maximumVisibleFactor
    ) {
        if (!Number.isFinite(reveal) || reveal < 0) {
            throw new RangeError(
                "Temporary reveal must be a non-negative finite number."
            );
        }
        if (!Number.isFinite(directionalBias)) {
            throw new RangeError(
                "Temporary directional bias must be finite."
            );
        }
        const start = Math.max(
            0,
            interaction.periodIndex - CONCERNED_NEIGHBORS
        );
        const end = Math.min(
            this.#periods.length - 1,
            interaction.periodIndex + CONCERNED_NEIGHBORS
        );

        for (let index = start; index <= end; index += 1) {
            const distance = Math.abs(index - interaction.periodIndex);
            const influence = distance === 0
                ? 1
                : influenceForDistance(distance);
            const directionalChange = directionalChangeFor(
                index - interaction.periodIndex,
                directionalBias,
                influence
            );
            const visibleFactor = clamp(
                interaction.visibleFactors[index]
                    + reveal * influence
                    + directionalChange,
                minimumVisibleFactor,
                maximumVisibleFactor
            );

            this.#periods[index].setVisibleFactor(visibleFactor);
        }

        return this.#periods[interaction.periodIndex].visibleFactor;
    }

    retainedDirectionalFactors(
        interaction,
        directionalBias,
        minimumVisibleFactor,
        maximumVisibleFactor,
        resistance,
        retainedReveal = 0
    ) {
        if (!Number.isFinite(directionalBias)) {
            throw new RangeError(
                "Retained directional bias must be finite."
            );
        }
        if (!Number.isFinite(resistance) || resistance <= 0) {
            throw new RangeError(
                "Directional resistance must be a positive finite number."
            );
        }
        if (!Number.isFinite(retainedReveal) || retainedReveal < 0) {
            throw new RangeError(
                "Retained reveal must be a non-negative finite number."
            );
        }
        const factors = interaction.visibleFactors.slice();
        const start = Math.max(
            0,
            interaction.periodIndex - CONCERNED_NEIGHBORS
        );
        const end = Math.min(
            this.#periods.length - 1,
            interaction.periodIndex + CONCERNED_NEIGHBORS
        );

        for (let index = start; index <= end; index += 1) {
            const offset = index - interaction.periodIndex;
            const distance = Math.abs(offset);
            const influence = distance === 0
                ? 1
                : influenceForDistance(distance);
            const force = directionalChangeFor(
                offset,
                directionalBias,
                influence
            );
            const revealedFactor = clamp(
                interaction.visibleFactors[index]
                    + retainedReveal * influence,
                minimumVisibleFactor,
                maximumVisibleFactor
            );

            factors[index] = resistedVisibleFactor(
                revealedFactor,
                force,
                minimumVisibleFactor,
                maximumVisibleFactor,
                resistance
            );
        }

        return Object.freeze(factors);
    }

    projectedXForInteraction(interaction) {
        const parameters = this.#resolvedParameters[interaction.periodIndex];
        if (!parameters) {
            throw new RangeError("Interaction period is outside the curtain.");
        }

        let projectedX = 0;
        for (let index = 0; index < interaction.periodIndex; index += 1) {
            projectedX += this.#resolvedParameters[index]
                .projectedCarrierSpacing;
        }

        return projectedX
            + interaction.localPosition * parameters.projectedCarrierSpacing;
    }

    resolve(surfaceParameters) {
        const parametersByVisibleFactor = new Map();
        const resolvedFor = (visibleFactor) => {
            if (!parametersByVisibleFactor.has(visibleFactor)) {
                parametersByVisibleFactor.set(
                    visibleFactor,
                    surfaceParameters.resolve(visibleFactor)
                );
            }

            return parametersByVisibleFactor.get(visibleFactor);
        };

        this.#resolvedParameters = Object.freeze(this.#periods.map(
            (period) => resolvedFor(period.visibleFactor)
        ));

        return this.#resolvedParameters[0]
            ?? resolvedFor(this.#resetCurtainState);
    }

    resolvedParametersAt(index) {
        const parameters = this.#resolvedParameters[index];
        if (!parameters) {
            throw new RangeError("Curtain Period has not been resolved.");
        }

        return parameters;
    }

    hasUniformVisibleFactor() {
        const first = this.#periods[0]?.visibleFactor;
        return this.#periods.every(
            (period) => period.visibleFactor === first
        );
    }

    #periodAt(projectedX) {
        if (this.#periods.length === 0
            || this.#resolvedParameters.length !== this.#periods.length) {
            throw new Error("CurtainField must be resolved before interaction.");
        }

        let leftEdge = 0;

        for (let index = 0; index < this.#periods.length; index += 1) {
            const width = this.#resolvedParameters[index]
                .projectedCarrierSpacing;
            const rightEdge = leftEdge + width;

            if (projectedX < rightEdge) {
                return { periodIndex: index, leftEdge, width };
            }

            leftEdge = rightEdge;
        }

        const periodIndex = this.#periods.length - 1;
        const width = this.#resolvedParameters[periodIndex]
            .projectedCarrierSpacing;

        return {
            periodIndex,
            leftEdge: leftEdge - width,
            width
        };
    }
}

function logDisplacementChanges(label, grabbedPeriodIndex, changes) {
    if (!label) {
        return;
    }

    console.group(`${label} — grabbed period ${grabbedPeriodIndex}`);
    for (const change of changes) {
        console.log([
            `Period ${change.periodIndex}:`,
            `before ${change.before}`,
            `after ${change.after}`
        ].join("\n"));
    }
    console.log(
        "Changed periods:",
        changes.filter((change) => change.before !== change.after).length
    );
    console.groupEnd();
}

function validateVisibleFactor(visibleFactor) {
    if (!Number.isFinite(visibleFactor)
        || visibleFactor < 0
        || visibleFactor > 1) {
        throw new RangeError("Visible Factor must be between 0 and 1.");
    }
}

function validatePositiveNumber(value, name) {
    if (!Number.isFinite(value) || value <= 0) {
        throw new RangeError(`${name} must be a positive finite number.`);
    }
}

function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), maximum);
}

function influenceTotalFor(periodIndex, direction, periodCount) {
    let total = 0;

    for (
        let distance = 1;
        distance <= CONCERNED_NEIGHBORS;
        distance += 1
    ) {
        const neighborIndex = periodIndex + direction * distance;

        if (neighborIndex < 0 || neighborIndex >= periodCount) {
            break;
        }

        total += influenceForDistance(distance);
    }

    return total;
}

function influenceForDistance(distance) {
    return 1 - distance / (CONCERNED_NEIGHBORS + 1);
}

function localDeformationFor(
    interaction,
    projectedDisplacement,
    periodLength,
    periodCount
) {
    const displacementInPeriods = projectedDisplacement / periodLength;
    const grabbedRedistribution = displacementInPeriods
        * GRABBED_PERIOD_PARTICIPATION;
    const leftRedistribution = interaction.rightwardOnly
        ? 0
        : displacementInPeriods
            - interaction.localPosition * grabbedRedistribution;
    const rightRedistribution = interaction.rightwardOnly
        ? -(displacementInPeriods - grabbedRedistribution)
        : leftRedistribution + grabbedRedistribution;
    const leftScale = interaction.leftInfluence === 0
        ? 0
        : leftRedistribution / interaction.leftInfluence;
    const rightScale = interaction.rightInfluence === 0
        ? 0
        : rightRedistribution / interaction.rightInfluence;
    const start = interaction.rightwardOnly
        ? interaction.periodIndex
        : Math.max(0, interaction.periodIndex - CONCERNED_NEIGHBORS);
    const end = Math.min(
        periodCount - 1,
        interaction.periodIndex + CONCERNED_NEIGHBORS
    );
    const redistributions = new Array(periodCount).fill(0);

    for (let index = start; index <= end; index += 1) {
        const offset = index - interaction.periodIndex;
        redistributions[index] = offset === 0
            ? grabbedRedistribution
            : redistributionForNeighbor(offset, leftScale, rightScale);
    }

    return { start, end, redistributions };
}

function redistributionForNeighbor(offset, leftScale, rightScale) {
    const influence = influenceForDistance(Math.abs(offset));
    return offset < 0
        ? leftScale * influence
        : -rightScale * influence;
}

function directionalChangeFor(offset, directionalBias, influence) {
    return offset === 0
        ? 0
        : -directionalBias * Math.sign(offset) * influence;
}

function resistedVisibleFactor(
    visibleFactor,
    force,
    minimumVisibleFactor,
    maximumVisibleFactor,
    resistance
) {
    if (force === 0) {
        return visibleFactor;
    }

    const limit = force > 0
        ? maximumVisibleFactor
        : minimumVisibleFactor;
    const factorRange = maximumVisibleFactor - minimumVisibleFactor;
    if (factorRange === 0 || visibleFactor === limit) {
        return limit;
    }

    const response = 1 - Math.exp(
        -resistance * Math.abs(force) / factorRange
    );
    return visibleFactor + (limit - visibleFactor) * response;
}
