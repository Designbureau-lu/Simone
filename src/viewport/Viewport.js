/** Selects and maps a fixed projected window over the continuous curtain. */
export class Viewport {
    #projectedOffset;
    #projectedExtent;
    #presentationExtent;
    #contentStart = 0;
    #contentEnd = 0;

    constructor({
        projectedOffset = 0,
        projectedExtent = 0,
        presentationExtent = 0
    } = {}) {
        this.setProjectedWindow(projectedOffset, projectedExtent);
        this.presentationExtent = presentationExtent;
    }

    get projectedOffset() {
        return this.#projectedOffset;
    }

    get projectedExtent() {
        return this.#projectedExtent;
    }

    get presentationExtent() {
        return this.#presentationExtent;
    }

    set presentationExtent(value) {
        validateCoordinate(value, "Viewport presentation extent");
        this.#presentationExtent = value;
    }

    setProjectedWindow(offset, extent) {
        validateCoordinate(offset, "Viewport projected offset");
        validateCoordinate(extent, "Viewport projected extent");
        this.#projectedOffset = offset;
        this.#projectedExtent = extent;
    }

    setProjectedContentRange(start, end) {
        validateCoordinate(start, "Projected content start");
        validateCoordinate(end, "Projected content end");

        if (end < start) {
            throw new RangeError("Projected content range must be ordered.");
        }

        this.#contentStart = start;
        this.#contentEnd = end;
        this.#projectedOffset = clamp(
            this.#projectedOffset,
            start,
            Math.max(start, end - this.#projectedExtent)
        );
    }

    setPosition(position) {
        if (!Number.isFinite(position)) {
            throw new RangeError("Viewport position must be finite.");
        }

        const maximumOffset = Math.max(
            this.#contentStart,
            this.#contentEnd - this.#projectedExtent
        );
        this.#projectedOffset = this.#contentStart
            + clamp(position, 0, 1)
                * (maximumOffset - this.#contentStart);
    }

    sourceRangeFor(projectedColumns) {
        if (!Array.isArray(projectedColumns)) {
            throw new TypeError("Viewport requires projected columns.");
        }

        const windowStart = this.#projectedOffset;
        const windowEnd = windowStart + this.#projectedExtent;
        let start = null;
        let end = null;

        for (let sourceX = 0; sourceX < projectedColumns.length; sourceX += 1) {
            const { placement, width } = projectedColumns[sourceX];
            const left = Math.min(
                placement.targetX,
                placement.targetX + width
            );
            const right = Math.max(
                placement.targetX,
                placement.targetX + width
            );

            if (right > windowStart && left < windowEnd) {
                start ??= sourceX;
                end = sourceX + 1;
            }
        }

        return Object.freeze({
            start: start ?? 0,
            end: end ?? 0
        });
    }

    toPresentationX(projectedX) {
        validateCoordinate(projectedX, "Viewport projected coordinate");
        return (projectedX - this.#projectedOffset) * this.#scale();
    }

    toProjectedX(presentationX) {
        validateCoordinate(presentationX, "Viewport presentation coordinate");
        return presentationX / this.#scale() + this.#projectedOffset;
    }

    presentationWidthBetween(startProjectedX, endProjectedX) {
        return this.toPresentationX(endProjectedX)
            - this.toPresentationX(startProjectedX);
    }

    #scale() {
        if (this.#projectedExtent <= 0 || this.#presentationExtent <= 0) {
            throw new RangeError(
                "Viewport extents must be positive before mapping coordinates."
            );
        }

        return this.#presentationExtent / this.#projectedExtent;
    }
}

function validateCoordinate(value, name) {
    if (!Number.isFinite(value) || value < 0) {
        throw new RangeError(`${name} must be a non-negative finite number.`);
    }
}

function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), maximum);
}
