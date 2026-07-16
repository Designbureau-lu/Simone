import { ImmutableArtwork } from "./ImmutableArtwork.js";

/**
 * Decodes ordered production segments and assembles one continuous artwork.
 * Segment boundaries remain private to this loading operation.
 */
export async function loadArtwork(files) {
    if (!Array.isArray(files)
        || files.length === 0
        || files.some((file) => !(file instanceof File))) {
        throw new TypeError("An ordered array of image files is required.");
    }

    const images = await Promise.all(files.map(decodeImage));

    if (images.length === 1) {
        return new ImmutableArtwork(images[0]);
    }

    const height = images[0].naturalHeight;

    if (images.some((image) => image.naturalHeight !== height)) {
        throw new RangeError(
            "All production segments must have the same pixel height."
        );
    }

    const width = images.reduce(
        (total, image) => total + image.naturalWidth,
        0
    );
    const source = document.createElement("canvas");
    source.width = width;
    source.height = height;

    const context = source.getContext("2d");
    if (!context) {
        throw new Error("A 2D context is unavailable for artwork assembly.");
    }

    context.imageSmoothingEnabled = false;
    let destinationX = 0;

    for (const image of images) {
        context.drawImage(image, destinationX, 0);
        destinationX += image.naturalWidth;
    }

    return new ImmutableArtwork(source);
}

function decodeImage(file) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        const objectUrl = URL.createObjectURL(file);

        image.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(image);
        };

        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error("The selected artwork could not be decoded."));
        };

        image.src = objectUrl;
    });
}
