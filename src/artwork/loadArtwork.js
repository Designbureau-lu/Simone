import { ImmutableArtwork } from "./ImmutableArtwork.js";

/**
 * Decodes ordered production segments and assembles one continuous artwork.
 * Segment boundaries remain private to this loading operation.
 */
export async function loadArtwork(files) {
    if (!Array.isArray(files)
        || files.length === 0
        || files.some((file) => !isImageSource(file))) {
        throw new TypeError("An ordered array of image files is required.");
    }

    const decoded = await Promise.allSettled(files.map(decodeImage));
    const images = [];

    for (let index = 0; index < decoded.length; index += 1) {
        const result = decoded[index];
        if (result.status === "fulfilled") {
            images.push(result.value);
        } else {
            console.error(
                `SIMONE could not load image "${sourceName(files[index])}".`,
                result.reason
            );
        }
    }

    if (images.length === 0) {
        throw new Error("None of the listed artwork images could be loaded.");
    }

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

function decodeImage(source) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        const objectUrl = source instanceof File
            ? URL.createObjectURL(source)
            : null;

        image.onload = () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
            resolve(image);
        };

        image.onerror = () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
            reject(new Error(
                `Artwork image "${sourceName(source)}" could not be decoded.`
            ));
        };

        image.src = objectUrl ?? source.url;
    });
}

function isImageSource(source) {
    return source instanceof File
        || (typeof source === "object"
            && source !== null
            && typeof source.name === "string"
            && typeof source.url === "string");
}

function sourceName(source) {
    return source.name;
}
