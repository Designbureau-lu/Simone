/** Derives the top from the original full destination height while retaining the existing lower edge. */
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
