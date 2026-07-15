const DEFAULT_APPEARANCE = Object.freeze({
    rearDarkening: Object.freeze({
        color: Object.freeze([0, 0, 0]),
        strength: 0.15
    }),
    crestHighlight: Object.freeze({
        color: Object.freeze([255, 255, 255]),
        strength: 0.1,
        widthFactor: 1.6,
        minimumWidth: 30,
        maximumWidth: 300,
        stops: freezeStops([
            [0, 0],
            [0.12, 0.06],
            [0.25, 0.28],
            [0.38, 0.68],
            [0.5, 1],
            [0.62, 0.68],
            [0.75, 0.28],
            [0.88, 0.06],
            [1, 0]
        ])
    }),
    valleyShadow: Object.freeze({
        color: Object.freeze([0, 0, 0]),
        strength: 0.06,
        stops: freezeStops([
            [0, 1],
            [0.22, 0],
            [0.78, 0],
            [1, 1]
        ])
    })
});

/** Owns all appearance tuning and supplies stable fold depth cues. */
export class SurfaceShading {
    constructor({ rearBrightness = 0.85 } = {}) {
        if (!Number.isFinite(rearBrightness)
            || rearBrightness < 0
            || rearBrightness > 1) {
            throw new RangeError("Rear brightness must be between 0 and 1.");
        }

        this.rearBrightness = rearBrightness;
        this.appearance = Object.freeze({
            ...DEFAULT_APPEARANCE,
            rearDarkening: Object.freeze({
                ...DEFAULT_APPEARANCE.rearDarkening,
                strength: 1 - rearBrightness
            })
        });
        Object.freeze(this);
    }

    factorFor(placement, surface) {
        if (placement.branch !== "rear") {
            return 1;
        }

        return 1 - this.appearance.rearDarkening.strength
            * surface.foldProgress;
    }

    appearanceFor(surface) {
        return Object.freeze({
            ...this.appearance,
            foldProgress: surface.foldProgress
        });
    }
}

function freezeStops(stops) {
    return Object.freeze(stops.map(([offset, intensity]) => Object.freeze({
        offset,
        intensity
    })));
}
