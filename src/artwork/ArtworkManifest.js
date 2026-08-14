/** Parses ordered intrinsic artwork segments and their production sources. */
export function artworkSegmentsFromManifest(source, applicationBaseUrl) {
    const manifest = parseArtworkManifest(source);
    const imageDirectory = new URL("public/images/", applicationBaseUrl);

    return Object.freeze(manifest.segments.map((segment) => Object.freeze({
        name: segment.id,
        url: new URL(encodedRelativePath(segment.source.src), imageDirectory)
            .href,
        width: segment.width,
        height: segment.height,
        sourceWidth: segment.source.width,
        sourceHeight: segment.source.height,
        byteSize: segment.source.byteSize
    })));
}

function parseArtworkManifest(source) {
    let manifest;
    try {
        manifest = JSON.parse(source);
    } catch (error) {
        throw new SyntaxError("Artwork manifest is not valid JSON.", { cause: error });
    }
    if (manifest?.version !== 3
        || !Array.isArray(manifest.segments)
        || manifest.segments.length === 0) {
        throw new TypeError("Artwork manifest structure is invalid.");
    }

    const segmentIds = new Set();
    const segments = manifest.segments.map((segment) => {
        if (!segment
            || typeof segment.id !== "string"
            || segment.id.trim() === ""
            || segmentIds.has(segment.id)
            || !positiveInteger(segment.logicalWidth)
            || !positiveInteger(segment.logicalHeight)) {
            throw new TypeError("Artwork intrinsic segment metadata is invalid.");
        }
        segmentIds.add(segment.id);
        validateSource(segment.source, segment);
        return Object.freeze({
            id: segment.id,
            width: segment.logicalWidth,
            height: segment.logicalHeight,
            source: Object.freeze({ ...segment.source })
        });
    });
    return Object.freeze({ version: manifest.version, segments: Object.freeze(segments) });
}

function validateSource(source, segment) {
    if (!source
        || typeof source.src !== "string"
        || source.src.trim() === ""
        || !positiveInteger(source.width)
        || !positiveInteger(source.height)
        || !positiveInteger(source.byteSize)) {
        throw new TypeError("Artwork source metadata is invalid.");
    }
    if (source.width !== segment.logicalWidth
        || source.height !== segment.logicalHeight) {
        throw new RangeError(
            `Artwork source does not match the intrinsic dimensions for `
            + `segment "${segment.id}".`
        );
    }
}

function positiveInteger(value) {
    return Number.isSafeInteger(value) && value > 0;
}

function encodedRelativePath(path) {
    const components = path.split("/");
    if (path.startsWith("/")
        || components.some((component) => (
            component === "" || component === "." || component === ".."
        ))) {
        throw new TypeError("Artwork source path is invalid.");
    }
    return components.map(encodeURIComponent).join("/");
}
