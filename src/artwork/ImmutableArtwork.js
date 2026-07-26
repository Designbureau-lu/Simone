/**
 * Immutable description of one continuous source artwork.
 *
 * Artwork is sacred: this model exposes references to exact vertical source
 * columns. It never resamples, generates, edits, or interprets source pixels.
 */
export class ImmutableArtwork {
    #source;
    #segments;

    constructor(source, imageWidths = [sourceWidthFor(source)]) {
        const isImage = source instanceof HTMLImageElement && source.complete;
        const isCanvas = source instanceof HTMLCanvasElement;

        if ((!isImage && !isCanvas)
            || sourceWidthFor(source) <= 0
            || sourceHeightFor(source) <= 0) {
            throw new TypeError(
                "ImmutableArtwork requires a non-empty decoded source."
            );
        }
        if (!Array.isArray(imageWidths) || imageWidths.length < 1
            || imageWidths.some((width) => !Number.isSafeInteger(width)
                || width < 1)) {
            throw new RangeError(
                "ImmutableArtwork image widths must be positive integers."
            );
        }

        this.#source = source;
        let sourceStart = 0;
        this.#segments = Object.freeze(imageWidths.map((width) => {
            const segment = Object.freeze({ sourceStart, width });
            sourceStart += width;
            return segment;
        }));
        this.width = sourceWidthFor(source);
        this.height = sourceHeightFor(source);
        this.imageCount = imageWidths.length;

        Object.freeze(this);
    }

    /** Returns an immutable reference to one exact, one-pixel source column. */
    columnAt(sourceX) {
        if (!Number.isInteger(sourceX) || sourceX < 0 || sourceX >= this.width) {
            throw new RangeError("Artwork column is outside the source image.");
        }

        return Object.freeze({
            source: this.#source,
            sourceX,
            sourceY: 0,
            width: 1,
            height: this.height
        });
    }

    logicalXForSourceX(sourceX, logicalImageWidth) {
        const segmentIndex = this.#segmentIndexForSourceX(sourceX);
        const segment = this.#segments[segmentIndex];
        return segmentIndex * logicalImageWidth
            + (sourceX - segment.sourceStart)
                / segment.width * logicalImageWidth;
    }

    sourceXForLogicalX(logicalX, logicalImageWidth) {
        const segmentIndex = Math.min(
            Math.floor(logicalX / logicalImageWidth),
            this.#segments.length - 1
        );
        const segment = this.#segments[segmentIndex];
        const localLogicalX = logicalX - segmentIndex * logicalImageWidth;
        return segment.sourceStart + Math.floor(
            localLogicalX / logicalImageWidth * segment.width
        );
    }

    #segmentIndexForSourceX(sourceX) {
        for (let index = 0; index < this.#segments.length; index += 1) {
            const segment = this.#segments[index];
            if (sourceX < segment.sourceStart + segment.width) {
                return index;
            }
        }
        return this.#segments.length - 1;
    }
}

function sourceWidthFor(source) {
    return source instanceof HTMLImageElement
        ? source.naturalWidth
        : source.width;
}

function sourceHeightFor(source) {
    return source instanceof HTMLImageElement
        ? source.naturalHeight
        : source.height;
}
