/**
 * Immutable description of one continuous source artwork.
 *
 * Artwork is sacred: this model exposes immutable vertical source mappings.
 * Source pixels and intrinsic artwork coordinates remain explicit so decoded
 * source validation never defines the geometry coordinate system.
 */
export class ImmutableArtwork {
    #segments;
    #columns;
    #decodedSegmentCount = 0;

    constructor(sources, { metadata = false } = {}) {
        if (metadata) {
            validateMetadata(sources);
            this.#initialize(sources);
            Object.freeze(this);
            return;
        }
        if (!Array.isArray(sources)
            || sources.length < 1
            || sources.some((source) => !isDecodedSource(source))) {
            throw new TypeError(
                "ImmutableArtwork requires decoded source images."
            );
        }

        const descriptors = sources.map((source, index) => ({
            name: `Artwork ${index + 1}`,
            url: null,
            width: sourceWidthFor(source),
            height: sourceHeightFor(source),
            sourceWidth: sourceWidthFor(source),
            sourceHeight: sourceHeightFor(source),
            source
        }));
        this.#initialize(descriptors);

        Object.freeze(this);
    }

    static fromMetadata(metadata) {
        return new ImmutableArtwork(metadata, { metadata: true });
    }

    #initialize(metadata) {
        let sourceStart = 0;
        this.#segments = Object.freeze(metadata.map((descriptor, index) => {
            const segment = {
                index,
                name: descriptor.name,
                url: descriptor.url,
                sourceStart,
                width: descriptor.width,
                height: descriptor.height,
                sourceWidth: descriptor.sourceWidth ?? descriptor.width,
                sourceHeight: descriptor.sourceHeight ?? descriptor.height,
                source: descriptor.source ?? null
            };
            sourceStart += segment.width;
            if (segment.source) {
                this.#decodedSegmentCount += 1;
            }
            return segment;
        }));
        this.width = sourceStart;
        this.height = Math.max(...this.#segments.map(({ height }) => height));
        this.imageCount = this.#segments.length;
        this.#columns = new Array(this.width);

        for (const segment of this.#segments) {
            if (segment.source) {
                this.#createColumnsFor(segment);
            }
        }
    }

    get decodedSegmentCount() {
        return this.#decodedSegmentCount;
    }

    get allSegmentsDecoded() {
        return this.#decodedSegmentCount === this.#segments.length;
    }

    segmentDescriptors() {
        return Object.freeze(this.#segments.map((segment) => Object.freeze({
            index: segment.index,
            name: segment.name,
            url: segment.url,
            sourceStart: segment.sourceStart,
            width: segment.width,
            height: segment.height,
            sourceWidth: segment.sourceWidth,
            sourceHeight: segment.sourceHeight
        })));
    }

    setSegmentSource(index, source) {
        const segment = this.#segments[index];
        if (!segment) {
            throw new RangeError("Artwork segment is outside the manifest.");
        }
        if (!isDecodedSource(source)) {
            throw new TypeError("Artwork segment source must be decoded.");
        }
        if (sourceWidthFor(source) !== segment.sourceWidth
            || sourceHeightFor(source) !== segment.sourceHeight) {
            throw new RangeError(
                `Artwork segment "${segment.name}" dimensions do not match its metadata.`
            );
        }
        if (segment.source === source) {
            return;
        }
        if (!segment.source) {
            this.#decodedSegmentCount += 1;
        }
        segment.source = source;
        this.#createColumnsFor(segment);
    }

    segmentIndicesForSourceRange(start, end) {
        if (!Number.isInteger(start)
            || !Number.isInteger(end)
            || start < 0
            || end < start
            || end > this.width) {
            throw new RangeError("Artwork source range is invalid.");
        }

        const indices = [];
        for (const segment of this.#segments) {
            const segmentEnd = segment.sourceStart + segment.width;
            if (segment.sourceStart < end && segmentEnd > start) {
                indices.push(segment.index);
            }
        }
        return Object.freeze(indices);
    }

    #createColumnsFor(segment) {
        const sourceScaleX = segment.sourceWidth / segment.width;
        for (let sourceX = 0; sourceX < segment.width; sourceX += 1) {
            const artworkX = segment.sourceStart + sourceX;
            this.#columns[artworkX] = Object.freeze({
                source: segment.source,
                sourceX: sourceX * sourceScaleX,
                sourceY: 0,
                width: 1,
                height: segment.height,
                sourceWidth: sourceScaleX,
                sourceHeight: segment.sourceHeight,
                artworkX
            });
        }
    }

    /** Returns the immutable source mapping for one logical artwork column. */
    columnAt(sourceX) {
        if (!Number.isInteger(sourceX) || sourceX < 0 || sourceX >= this.width) {
            throw new RangeError("Artwork column is outside the source image.");
        }

        return this.#columns[sourceX] ?? null;
    }

    semanticXForSourceX(sourceX, semanticImageWidth) {
        const segmentIndex = this.#segmentIndexForSourceX(sourceX);
        const segment = this.#segments[segmentIndex];
        return segmentIndex * semanticImageWidth
            + (sourceX - segment.sourceStart)
                / segment.width * semanticImageWidth;
    }

    sourceXForSemanticX(semanticX, semanticImageWidth) {
        const semanticArtworkWidth = this.#segments.length
            * semanticImageWidth;
        if (semanticX >= semanticArtworkWidth) {
            return this.width;
        }
        if (semanticX <= 0) {
            return 0;
        }
        const segmentIndex = Math.min(
            Math.floor(semanticX / semanticImageWidth),
            this.#segments.length - 1
        );
        const segment = this.#segments[segmentIndex];
        const localSemanticX = semanticX
            - segmentIndex * semanticImageWidth;
        return segment.sourceStart + Math.floor(
            localSemanticX / semanticImageWidth * segment.width
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

function validateMetadata(metadata) {
    if (!Array.isArray(metadata) || metadata.length < 1) {
        throw new TypeError("Artwork metadata requires at least one segment.");
    }
    for (const descriptor of metadata) {
        if (!descriptor
            || typeof descriptor.name !== "string"
            || descriptor.name.trim() === ""
            || typeof descriptor.url !== "string"
            || descriptor.url.trim() === ""
            || !Number.isSafeInteger(descriptor.width)
            || descriptor.width <= 0
            || !Number.isSafeInteger(descriptor.height)
            || descriptor.height <= 0
            || !Number.isSafeInteger(
                descriptor.sourceWidth ?? descriptor.width
            )
            || (descriptor.sourceWidth ?? descriptor.width) <= 0
            || !Number.isSafeInteger(
                descriptor.sourceHeight ?? descriptor.height
            )
            || (descriptor.sourceHeight ?? descriptor.height) <= 0) {
            throw new TypeError("Artwork segment metadata is invalid.");
        }
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
