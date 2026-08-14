/** Parses ordered segment metadata without loading artwork pixels. */
export function artworkSegmentsFromManifest(source, applicationBaseUrl) {
    let manifest;
    try {
        manifest = JSON.parse(source);
    } catch (error) {
        throw new SyntaxError("Artwork manifest is not valid JSON.", {
            cause: error
        });
    }

    if (manifest?.version !== 1
        || !Array.isArray(manifest.segments)
        || manifest.segments.length === 0) {
        throw new TypeError("Artwork manifest structure is invalid.");
    }

    const imageDirectory = new URL("public/images/", applicationBaseUrl);
    const names = new Set();
    return Object.freeze(manifest.segments.map((segment) => {
        if (!segment
            || typeof segment.src !== "string"
            || segment.src.trim() === ""
            || names.has(segment.src)
            || !Number.isSafeInteger(segment.width)
            || segment.width <= 0
            || !Number.isSafeInteger(segment.height)
            || segment.height <= 0
            || !validOptionalExtent(segment.sourceWidth)
            || !validOptionalExtent(segment.sourceHeight)
            || ((segment.sourceWidth === undefined)
                !== (segment.sourceHeight === undefined))
            || (segment.byteSize !== undefined
                && (!Number.isSafeInteger(segment.byteSize)
                    || segment.byteSize <= 0))) {
            throw new TypeError("Artwork segment metadata is invalid.");
        }
        names.add(segment.src);
        return Object.freeze({
            name: segment.src,
            url: new URL(encodeURIComponent(segment.src), imageDirectory).href,
            width: segment.width,
            height: segment.height,
            sourceWidth: segment.sourceWidth ?? segment.width,
            sourceHeight: segment.sourceHeight ?? segment.height,
            byteSize: segment.byteSize ?? null
        });
    }));
}

function validOptionalExtent(value) {
    return value === undefined
        || (Number.isSafeInteger(value) && value > 0);
}
