/**
 * Immutable description of one continuous source artwork.
 *
 * Artwork is sacred: this model exposes references to exact vertical source
 * columns. It never resamples, generates, edits, or interprets source pixels.
 */
export class ImmutableArtwork {
    #source;

    constructor(source) {
        const isImage = source instanceof HTMLImageElement && source.complete;
        const isCanvas = source instanceof HTMLCanvasElement;

        if ((!isImage && !isCanvas)
            || sourceWidthFor(source) <= 0
            || sourceHeightFor(source) <= 0) {
            throw new TypeError(
                "ImmutableArtwork requires a non-empty decoded source."
            );
        }

        this.#source = source;
        this.width = sourceWidthFor(source);
        this.height = sourceHeightFor(source);

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
