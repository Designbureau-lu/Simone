import { PeriodicSurface } from "./PeriodicSurface.js";

/**
 * Shared opening-response policy for the current experimental surfaces.
 *
 * Amplitude is fully expressed at the physical closed limit and falls smoothly
 * to zero at 100% open. Future surfaces may override this policy or extend the
 * PeriodicSurface contract directly when their physical model differs.
 */
export class OpeningResponsiveSurface extends PeriodicSurface {
    amplitudeFor(parameters) {
        if (parameters.currentPosition >= 1) {
            return 0;
        }

        const availableOpening = 1 - parameters.closedLimit;
        if (availableOpening <= 0) {
            return 0;
        }

        const amplitudeFactor = clamp(
            (1 - parameters.currentPosition) / availableOpening,
            0,
            1
        );

        return parameters.amplitude * amplitudeFactor;
    }
}

function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), maximum);
}
