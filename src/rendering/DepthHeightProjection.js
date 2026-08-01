export const COLUMN_DEPTH_HEIGHT_STRENGTH = 0.25;

export function depthHeightFactor(
    normalizedDepth,
    strength = COLUMN_DEPTH_HEIGHT_STRENGTH
) {
    if (!Number.isFinite(normalizedDepth)
        || normalizedDepth < 0
        || normalizedDepth > 1
        || !Number.isFinite(strength)
        || strength < 0
        || strength >= 1) {
        throw new RangeError("Depth-height factor is invalid.");
    }
    return 1 - strength * normalizedDepth;
}

export function depthScaledHeight(
    sourceHeight,
    normalizedDepth,
    scale = 1,
    strength = COLUMN_DEPTH_HEIGHT_STRENGTH
) {
    if (!Number.isFinite(sourceHeight)
        || sourceHeight <= 0
        || !Number.isFinite(scale)
        || scale <= 0) {
        throw new RangeError("Depth-scaled height is invalid.");
    }
    return sourceHeight * scale
        * depthHeightFactor(normalizedDepth, strength);
}

/** Derives the top from height while retaining the existing lower edge. */
export function depthAnchoredTop(
    sourceHeight,
    projectedY,
    destinationHeight,
    scale = 1
) {
    if (!Number.isFinite(sourceHeight)
        || sourceHeight <= 0
        || !Number.isFinite(projectedY)
        || !Number.isFinite(destinationHeight)
        || destinationHeight <= 0
        || !Number.isFinite(scale)
        || scale <= 0) {
        throw new RangeError("Depth-anchored top is invalid.");
    }
    return (projectedY + sourceHeight) * scale - destinationHeight;
}
