import { OpeningResponsiveSurface } from "./OpeningResponsiveSurface.js";

/**
 * Experimental continuous family of periodic profiles.
 *
 * profileShape zero reproduces SineSurface exactly. Increasing it applies a
 * smooth power transformation that broadens one face and tightens the valley.
 * This remains experimental geometry, not a physical fold model.
 */
export class MorphingSurface extends OpeningResponsiveSurface {
    frameFor(artwork, parameters) {
        const amplitude = this.amplitudeFor(parameters);

        return Object.freeze({
            width: artwork.width,
            height: artwork.height + 2 * amplitude
        });
    }

    mapColumn(column, parameters) {
        const amplitude = this.amplitudeFor(parameters);
        const sourceX = column.sourceX;
        const targetX = sourceX / parameters.gathering;
        const phase = (2 * Math.PI * sourceX) / parameters.carrierDistance;

        if (parameters.profileShape === 0) {
            return mapSineColumn(sourceX, targetX, phase, amplitude, parameters);
        }

        return mapMorphedColumn(sourceX, targetX, phase, amplitude, parameters);
    }
}

/** Preserves the original equations and evaluation order at profileShape zero. */
function mapSineColumn(sourceX, targetX, phase, amplitude, parameters) {
    const targetY = amplitude + amplitude * Math.sin(phase);
    const localSlope = amplitude
        * (2 * Math.PI / parameters.projectedCarrierSpacing)
        * Math.cos(phase);

    return createPlacement(sourceX, targetX, targetY, localSlope);
}

function mapMorphedColumn(sourceX, targetX, phase, amplitude, parameters) {
    const profile = calculateMorphingProfile(phase, parameters.profileShape);
    const targetY = 2 * amplitude * profile.value;
    const localSlope = 2
        * amplitude
        * profile.phaseDerivative
        * (2 * Math.PI / parameters.projectedCarrierSpacing);

    return createPlacement(sourceX, targetX, targetY, localSlope);
}

/** Returns a normalized profile and its analytic derivative by phase. */
export function calculateMorphingProfile(phase, profileShape) {
    const normalizedSine = (1 + Math.sin(phase)) / 2;
    const exponent = 1 + 3 * profileShape;
    const inverseFace = 1 - normalizedSine;

    return Object.freeze({
        value: 1 - inverseFace ** exponent,
        phaseDerivative: exponent
            * inverseFace ** (exponent - 1)
            * Math.cos(phase)
            / 2
    });
}

export function createPlacement(sourceX, targetX, targetY, localSlope) {
    return Object.freeze({
        sourceX,
        targetX,
        targetY,
        localSlope
    });
}
