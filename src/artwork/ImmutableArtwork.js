/**
 * Immutable description of one continuous source artwork.
 *
 * Artwork is sacred: this model exposes references to exact vertical source
 * columns. It never resamples, generates, edits, or interprets source pixels.
 */
export class ImmutableArtwork {
    #segments;
    #columns;

    constructor(sources) {
        if (!Array.isArray(sources)
            || sources.length < 1
            || sources.some((source) => !isDecodedSource(source))) {
            throw new TypeError(
                "ImmutableArtwork requires decoded source images."
            );
        }

        let sourceStart = 0;
        this.#segments = Object.freeze(sources.map((source) => {
            const width = sourceWidthFor(source);
            const segment = Object.freeze({
                source,
                sourceStart,
                width,
                height: sourceHeightFor(source)
            });
            sourceStart += width;
            return segment;
        }));
        this.width = sourceStart;
        this.height = Math.max(...this.#segments.map(({ height }) => height));
        this.imageCount = this.#segments.length;
        this.#columns = Object.freeze(this.#segments.flatMap((segment) =>
            Array.from({ length: segment.width }, (_, sourceX) =>
                Object.freeze({
                    source: segment.source,
                    sourceX,
                    sourceY: 0,
                    width: 1,
                    height: segment.height,
                    artworkX: segment.sourceStart + sourceX
                })
            )
        ));

        Object.freeze(this);
    }

    /** Returns an immutable reference to one exact, one-pixel source column. */
    columnAt(sourceX) {
        if (!Number.isInteger(sourceX) || sourceX < 0 || sourceX >= this.width) {
            throw new RangeError("Artwork column is outside the source image.");
        }

        return this.#columns[sourceX];
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

function isDecodedSource(source) {
    const isImage = source instanceof HTMLImageElement && source.complete;
    const isCanvas = source instanceof HTMLCanvasElement;
    return (isImage || isCanvas)
        && Number.isSafeInteger(sourceWidthFor(source))
        && sourceWidthFor(source) > 0
        && Number.isSafeInteger(sourceHeightFor(source))
        && sourceHeightFor(source) > 0;
}
