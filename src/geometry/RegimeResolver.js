/** Stable identifiers for the three geometric fold regimes. */
export const SurfaceRegime = Object.freeze({
    SEPARATED_FOLD: "separated-fold",
    CLOSURE_REGIME: "closure-regime",
    CONTACTED_FOLD: "contacted-fold"
});

/**
 * Selects the active geometric regime from resolved model parameters.
 *
 * A single model transition threshold is expressed over normalized gathering.
 * This resolver chooses geometry only; it does not decide visibility or
 * rendering behavior. Equality represents the zero-width Closure regime.
 */
export class RegimeResolver {
    resolve(parameters) {
        const requiredValues = [
            parameters?.gatheringProgress,
            parameters?.transitionStart,
            parameters?.transitionEnd
        ];

        if (requiredValues.some((value) => !Number.isFinite(value))) {
            throw new TypeError("RegimeResolver requires resolved transition parameters.");
        }

        if (parameters.gatheringProgress < parameters.transitionStart) {
            return SurfaceRegime.SEPARATED_FOLD;
        }

        if (parameters.gatheringProgress > parameters.transitionEnd) {
            return SurfaceRegime.CONTACTED_FOLD;
        }

        return SurfaceRegime.CLOSURE_REGIME;
    }
}
