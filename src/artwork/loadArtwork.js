import { ImmutableArtwork } from "./ImmutableArtwork.js";

/**
 * Decodes ordered production segments as one continuous virtual artwork.
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

    return new ImmutableArtwork(images);
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
