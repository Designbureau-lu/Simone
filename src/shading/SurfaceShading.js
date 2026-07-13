/**
 * Shading layer: converts local surface orientation into a brightness factor.
 *
 * This model has no light source. A flat, front-facing surface has full
 * brightness, while increasing absolute slope produces restrained darkening.
 * It never reads or changes artwork pixels and knows nothing about rendering.
 */
export class SurfaceShading {
    constructor({ minimumBrightness = 0.8 } = {}) {
        if (!Number.isFinite(minimumBrightness) || minimumBrightness < 0 || minimumBrightness > 1) {
            throw new RangeError("Minimum brightness must be between 0 and 1.");
        }

        this.minimumBrightness = minimumBrightness;
        Object.freeze(this);
    }

    factorFor(placement, surface) {
        // Surface state is intentionally available for future physical coupling.
        // The current shading behavior remains dependent on local slope only.
        void surface;
        const facing = 1 / Math.sqrt(1 + placement.localSlope ** 2);

        return this.minimumBrightness + (1 - this.minimumBrightness) * facing;
    }
}
