/** Geometry-agnostic horizontal window over the continuous curtain. */
export class Viewport {
    constructor({ visibleWidth, visibleHeight, horizontalOffset = 0 }) {
        validateNonNegative(visibleWidth, "Viewport visible width");
        validateNonNegative(visibleHeight, "Viewport visible height");
        validateNonNegative(horizontalOffset, "Viewport horizontal offset");

        this.visibleWidth = visibleWidth;
        this.visibleHeight = visibleHeight;
        this.horizontalOffset = horizontalOffset;
    }

    setSize(width, height) {
        validateNonNegative(width, "Viewport visible width");
        validateNonNegative(height, "Viewport visible height");
        this.visibleWidth = width;
        this.visibleHeight = height;
    }

    setPosition(position, contentWidth) {
        if (!Number.isFinite(position)) {
            throw new RangeError("Viewport position must be finite.");
        }

        validateNonNegative(contentWidth, "Viewport content width");
        const maximumOffset = Math.max(0, contentWidth - this.visibleWidth);
        this.horizontalOffset = clamp(position, 0, 1) * maximumOffset;
    }

    constrainTo(contentWidth) {
        validateNonNegative(contentWidth, "Viewport content width");
        this.horizontalOffset = clamp(
            this.horizontalOffset,
            0,
            Math.max(0, contentWidth - this.visibleWidth)
        );
    }
}

function validateNonNegative(value, name) {
    if (!Number.isFinite(value) || value < 0) {
        throw new RangeError(`${name} must be a non-negative finite number.`);
    }
}

function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), maximum);
}
