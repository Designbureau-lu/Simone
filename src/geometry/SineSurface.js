import { OpeningResponsiveSurface } from "./OpeningResponsiveSurface.js";

/**
 * Current periodic surface implementation.
 *
 * These equations are the unchanged sine geometry previously embedded in
 * WaveGeometry. This class is responsible only for geometric placement.
 */
export class SineSurface extends OpeningResponsiveSurface {
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
        const targetY = amplitude + amplitude * Math.sin(phase);
        const localSlope = amplitude
            * (2 * Math.PI / parameters.projectedCarrierSpacing)
            * Math.cos(phase);

        return Object.freeze({
            sourceX,
            targetX,
            targetY,
            localSlope
        });
    }
}
