/** Stable identifiers for the three operating phases. */
export const OperatingPhase = Object.freeze({
    PRE_TRANSITION: "pre-transition",
    TRANSITION: "transition",
    POST_TRANSITION: "post-transition"
});

/**
 * Selects the active operating phase from resolved model parameters.
 *
 * A single model transition threshold is expressed over normalized gathering.
 * This resolver chooses an operating phase only; it does not decide visibility
 * or rendering behavior. Equality represents the transition phase.
 */
export class OperatingPhaseResolver {
    resolve(parameters) {
        const requiredValues = [
            parameters?.gatheringProgress,
            parameters?.transitionStart,
            parameters?.transitionEnd
        ];

        if (requiredValues.some((value) => !Number.isFinite(value))) {
            throw new TypeError(
                "OperatingPhaseResolver requires resolved transition parameters."
            );
        }

        if (parameters.gatheringProgress < parameters.transitionStart) {
            return OperatingPhase.PRE_TRANSITION;
        }

        if (parameters.gatheringProgress > parameters.transitionEnd) {
            return OperatingPhase.POST_TRANSITION;
        }

        return OperatingPhase.TRANSITION;
    }
}
