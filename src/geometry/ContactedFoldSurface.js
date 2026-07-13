import { OpeningResponsiveSurface } from "./OpeningResponsiveSurface.js";
import { calculateMorphingProfile, createPlacement } from "./MorphingSurface.js";

/**
 * Experimental post-transition geometry.
 *
 * It begins exactly at the completed front-dominant morph, then progressively
 * narrows that remaining profile as gathering increases. No columns or hidden
 * branches are removed; this is still one continuous periodic curve.
 */
export class ContactedFoldSurface extends OpeningResponsiveSurface {
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
        const profile = calculateMorphingProfile(phase, parameters.profileShape);
        const narrowingExponent = 1 + 5 * parameters.contactedNarrowing;
        const narrowedProfile = profile.value ** narrowingExponent;
        const narrowedDerivative = narrowingExponent
            * profile.value ** (narrowingExponent - 1)
            * profile.phaseDerivative;
        const targetY = 2 * amplitude * narrowedProfile;
        const localSlope = 2
            * amplitude
            * narrowedDerivative
            * (2 * Math.PI / parameters.projectedCarrierSpacing);

        return createPlacement(sourceX, targetX, targetY, localSlope);
    }
}
