/**
 * Owns physical curtain parameters and SIMONE approximation parameters.
 *
 * The physical operating position is bounded by closed and open limits. Model
 * transition is explicitly separate and controls only the approximation.
 */
export class SurfaceParameters {
    constructor({
        closedLimit = 0.2,
        openLimit = 0.9,
        currentPosition = 0.55,
        amplitude = 20,
        carrierDistance = 100,
        modelTransition = 0.6
    } = {}) {
        this.configure({
            closedLimit,
            openLimit,
            currentPosition,
            amplitude,
            carrierDistance,
            modelTransition
        });
    }

    configure({
        closedLimit = this.closedLimit,
        openLimit = this.openLimit,
        currentPosition = this.currentPosition,
        amplitude = this.amplitude,
        carrierDistance = this.carrierDistance,
        modelTransition = this.modelTransition
    }) {
        validateParameters({
            closedLimit,
            openLimit,
            currentPosition,
            amplitude,
            carrierDistance,
            modelTransition
        });

        this.closedLimit = closedLimit;
        this.openLimit = openLimit;
        this.currentPosition = clamp(currentPosition, closedLimit, openLimit);
        this.amplitude = amplitude;
        this.carrierDistance = carrierDistance;
        this.modelTransition = modelTransition;
    }

    /** Returns the effective parameters consumed by geometry and shading. */
    resolve() {
        const gatheringProgress = normalizeOperatingPosition(
            this.currentPosition,
            this.closedLimit,
            this.openLimit
        );
        const gathering = resolveGeometryGathering(this.currentPosition);
        const projectedCarrierSpacing = resolveProjectedCarrierSpacing(
            this.carrierDistance,
            this.currentPosition
        );

        return Object.freeze({
            closedLimit: this.closedLimit,
            openLimit: this.openLimit,
            currentPosition: this.currentPosition,
            gathering,
            amplitude: this.amplitude,
            carrierDistance: this.carrierDistance,
            projectedCarrierSpacing,
            modelTransition: this.modelTransition,
            gatheringProgress,
            transitionStart: this.modelTransition,
            transitionEnd: this.modelTransition,
            profileShape: resolveProfileShape(gatheringProgress, this.modelTransition),
            contactedNarrowing: resolveContactedNarrowing(
                gatheringProgress,
                this.modelTransition
            )
        });
    }

}

function validateParameters(parameters) {
    const { closedLimit, openLimit, currentPosition } = parameters;

    if (!Number.isFinite(closedLimit) || closedLimit <= 0 || closedLimit > 1) {
        throw new RangeError("Closed limit must be greater than 0 and at most 1.");
    }

    if (!Number.isFinite(openLimit) || openLimit < closedLimit || openLimit > 1) {
        throw new RangeError("Open limit must be between closed limit and 1.");
    }

    if (!Number.isFinite(currentPosition)) {
        throw new RangeError("Current position must be finite.");
    }

    if (!Number.isFinite(parameters.amplitude) || parameters.amplitude < 0) {
        throw new RangeError("Wave amplitude must be a non-negative finite number.");
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
    const projectedMillimetres = carrierDistance * currentPosition;

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
