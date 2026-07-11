import { Artwork } from "./Artwork.js";

/**
 * Decodes a user-selected image into the immutable artwork domain model.
 * File and browser decoding concerns remain isolated from the rest of SIMONE.
 */
export function loadArtwork(file) {
    if (!(file instanceof File)) {
        return Promise.reject(new TypeError("An image file is required."));
    }

    return new Promise((resolve, reject) => {
        const image = new Image();
        const objectUrl = URL.createObjectURL(file);

        image.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(new Artwork(image));
        };

        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error("The selected artwork could not be decoded."));
        };

        image.src = objectUrl;
    });
}
