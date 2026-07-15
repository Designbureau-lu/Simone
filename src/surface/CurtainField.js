/** Mutable local state for one geometric curtain period. */
export class Period {
    constructor(index, visibleFactor) {
        this.index = index;
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
    #defaultVisibleFactor;
    #periodLength = null;

    constructor({ visibleFactor = 0.55 } = {}) {
        this.#defaultVisibleFactor = visibleFactor;
        validateVisibleFactor(visibleFactor);
    }

    get periods() {
        return this.#periods;
    }

    get visibleFactor() {
        return this.#periods[0]?.visibleFactor
            ?? this.#defaultVisibleFactor;
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
            (_, index) => new Period(index, this.#defaultVisibleFactor)
        ));
        this.#resolvedParameters = Object.freeze([]);
    }

    setVisibleFactorForAll(visibleFactor) {
        validateVisibleFactor(visibleFactor);
        this.#defaultVisibleFactor = visibleFactor;

        for (const period of this.#periods) {
            period.setVisibleFactor(visibleFactor);
        }
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
            ?? resolvedFor(this.#defaultVisibleFactor);
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
