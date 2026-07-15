/**
 * Immutable description of source artwork.
 *
 * Artwork is sacred: this model exposes references to exact vertical source
 * columns. It never resamples, generates, edits, or interprets source pixels.
 */
export class Artwork {
    #image;

    constructor(image) {
        if (!(image instanceof HTMLImageElement) || !image.complete) {
            throw new TypeError("Artwork requires a fully loaded HTML image.");
        }

        this.#image = image;
        this.width = image.naturalWidth;
        this.height = image.naturalHeight;

        Object.freeze(this);
    }

    /** Returns an immutable reference to one exact, one-pixel source column. */
    columnAt(sourceX) {
        if (!Number.isInteger(sourceX) || sourceX < 0 || sourceX >= this.width) {
            throw new RangeError("Artwork column is outside the source image.");
        }

        return Object.freeze({
            source: this.#image,
            sourceX,
            sourceY: 0,
            width: 1,
            height: this.height
        });
    }
}
