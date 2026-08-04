/** Structural slice height: the lower endpoint rises by h and its conceptual mirror falls by h. */
export function structuralSliceHeight(
    sourceHeight,
    targetY,
    periodMaximumTargetY,
    scale = 1
) {
    if (!Number.isFinite(sourceHeight)
        || sourceHeight <= 0
        || !Number.isFinite(targetY)
        || !Number.isFinite(periodMaximumTargetY)
        || periodMaximumTargetY < targetY
        || !Number.isFinite(scale)
        || scale <= 0) {
        throw new RangeError("Structural slice height is invalid.");
    }
    const h = periodMaximumTargetY - targetY;
    const destinationHeight = (sourceHeight - 2 * h) * scale;
    if (destinationHeight <= 0) {
        throw new RangeError("Structural slice height is invalid.");
    }
    return destinationHeight;
}

/** Derives the top while keeping the slice attached to the authoritative lower fold. */
export function lowerAnchoredTop(
    sourceHeight,
    targetY,
    destinationHeight,
    scale = 1
) {
    if (!Number.isFinite(sourceHeight)
        || sourceHeight <= 0
        || !Number.isFinite(targetY)
        || !Number.isFinite(destinationHeight)
        || destinationHeight <= 0
        || !Number.isFinite(scale)
        || scale <= 0) {
        throw new RangeError("Lower-anchored top is invalid.");
    }
    return (targetY + sourceHeight) * scale - destinationHeight;
}
