export const ARTWORK_REPRESENTATION_IDS = Object.freeze(["a", "b"]);

/** Parses ordered logical segments for one selected raster representation. */
export function artworkSegmentsFromManifest(
    source,
    applicationBaseUrl,
    representationId = "b"
) {
    const manifest = parseArtworkManifest(source);
    if (typeof representationId !== "string" || representationId === "") {
        throw new TypeError("Artwork representation selection is invalid.");
    }

    const imageDirectory = new URL("public/images/", applicationBaseUrl);
    return Object.freeze(manifest.segments.map((segment) => {
        const representation = segment.representations.find(
            ({ id }) => id === representationId
        );
        if (!representation) {
            throw new RangeError(
                `Artwork representation "${representationId}" is missing `
                + `for segment "${segment.id}".`
            );
        }

        return Object.freeze({
            name: segment.id,
            url: new URL(encodedRelativePath(representation.src), imageDirectory)
                .href,
            width: segment.width,
            height: segment.height,
            sourceWidth: representation.width,
            sourceHeight: representation.height,
            byteSize: representation.byteSize,
            representationId,
            representationLabel: representationLabel(representationId)
        });
    }));
}

/** Returns representations that are available for every logical segment. */
export function artworkRepresentationIdsFromManifest(source) {
    const manifest = parseArtworkManifest(source);
    const common = manifest.segments[0].representations
        .map(({ id }) => id)
        .filter((id) => manifest.segments.every((segment) => (
            segment.representations.some((representation) => (
                representation.id === id
            ))
        )));
    return Object.freeze(common);
}

export function representationLabel(id) {
    return `SOURCE ${id.toUpperCase()}`;
}

function parseArtworkManifest(source) {
    let manifest;
    try {
        manifest = JSON.parse(source);
    } catch (error) {
        throw new SyntaxError("Artwork manifest is not valid JSON.", {
            cause: error
        });
    }

    if (manifest?.version !== 2
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
            || !positiveInteger(segment.logicalHeight)
            || !Array.isArray(segment.representations)
            || segment.representations.length === 0) {
            throw new TypeError("Artwork logical segment metadata is invalid.");
        }
        segmentIds.add(segment.id);

        const representationIds = new Set();
        const representations = segment.representations.map((representation) => {
            validateRepresentation(
                representation,
                segment,
                representationIds
            );
            representationIds.add(representation.id);
            return Object.freeze({ ...representation });
        });
        const scales = new Set(representations.map((representation) => (
            representation.width / segment.logicalWidth
        )));
        if (scales.size !== representations.length) {
            throw new RangeError(
                `Artwork segment "${segment.id}" repeats a raster scale.`
            );
        }

        return Object.freeze({
            id: segment.id,
            width: segment.logicalWidth,
            height: segment.logicalHeight,
            representations: Object.freeze(representations)
        });
    });

    return Object.freeze({
        version: manifest.version,
        segments: Object.freeze(segments)
    });
}

function validateRepresentation(representation, segment, ids) {
    if (!representation
        || typeof representation.id !== "string"
        || representation.id.trim() === ""
        || !ARTWORK_REPRESENTATION_IDS.includes(representation.id)
        || ids.has(representation.id)
        || typeof representation.src !== "string"
        || representation.src.trim() === ""
        || !positiveInteger(representation.width)
        || !positiveInteger(representation.height)
        || !positiveInteger(representation.byteSize)) {
        throw new TypeError("Artwork raster representation metadata is invalid.");
    }

    const horizontalDivisor = segment.logicalWidth / representation.width;
    const verticalDivisor = segment.logicalHeight / representation.height;
    if (!Number.isInteger(horizontalDivisor)
        || horizontalDivisor < 1
        || horizontalDivisor > 2
        || horizontalDivisor !== verticalDivisor) {
        throw new RangeError(
            `Artwork representation "${representation.id}" does not have `
            + `a deterministic scale and matching aspect ratio for segment `
            + `"${segment.id}".`
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
        throw new TypeError("Artwork representation path is invalid.");
    }
    return components.map(encodeURIComponent).join("/");
}
