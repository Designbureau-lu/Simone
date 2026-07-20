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

    constructor({ resetCurtainState = 0.55 } = {}) {
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

    applyLocalDisplacement(
        interaction,
        projectedDisplacement,
        periodLength,
        minimumVisibleFactor,
        maximumVisibleFactor
    ) {
        const displacementInPeriods = projectedDisplacement / periodLength;
        const grabbedRedistribution = displacementInPeriods
            * GRABBED_PERIOD_PARTICIPATION;
        const leftRedistribution = displacementInPeriods
            - interaction.localPosition * grabbedRedistribution;
        const rightRedistribution = leftRedistribution
            + grabbedRedistribution;
        const leftScale = interaction.leftInfluence === 0
            ? 0
            : leftRedistribution / interaction.leftInfluence;
        const rightScale = interaction.rightInfluence === 0
            ? 0
            : rightRedistribution / interaction.rightInfluence;
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

            const redistribution = offset === 0
                ? grabbedRedistribution
                : redistributionForNeighbor(offset, leftScale, rightScale);
            const visibleFactor = clamp(
                interaction.visibleFactors[index]
                    + redistribution,
                minimumVisibleFactor,
                maximumVisibleFactor
            );

            this.#periods[index].setVisibleFactor(visibleFactor);
        }

        return this.#periods[interaction.periodIndex].visibleFactor;
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

function redistributionForNeighbor(offset, leftScale, rightScale) {
    const influence = influenceForDistance(Math.abs(offset));
    return offset < 0
        ? leftScale * influence
        : -rightScale * influence;
}
