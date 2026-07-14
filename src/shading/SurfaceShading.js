/** Supplies a stable, branch-dependent depth cue. */
export class SurfaceShading {
    constructor({ rearBrightness = 0.85 } = {}) {
        if (!Number.isFinite(rearBrightness)
            || rearBrightness < 0
            || rearBrightness > 1) {
            throw new RangeError("Rear brightness must be between 0 and 1.");
        }

        this.rearBrightness = rearBrightness;
        Object.freeze(this);
    }

    factorFor(placement, surface) {
        if (placement.branch !== "rear") {
            return 1;
        }

        const progress = rearDarkeningProgressFor(surface);
        const fullDarkness = 1 - this.rearBrightness;

        return 1 - fullDarkness * progress;
    }
}

function rearDarkeningProgressFor(surface) {
    const modelTransition = 1 - surface.modelTransition;

    if (modelTransition >= surface.maximumVisibleFactor) {
        return surface.visibleFactor <= modelTransition ? 1 : 0;
    }

    return clamp(
        (surface.maximumVisibleFactor - surface.visibleFactor)
            / (surface.maximumVisibleFactor - modelTransition),
        0,
        1
    );
}

function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), maximum);
}
