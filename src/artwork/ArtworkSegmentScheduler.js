export const SegmentLoadState = Object.freeze({
    KNOWN: "known",
    QUEUED: "queued",
    REQUESTED: "requested",
    LOADED: "loaded",
    DECODING: "decoding",
    DECODED: "decoded",
    FAILED: "failed"
});

export const SegmentPriority = Object.freeze({
    BACKGROUND: 0,
    IDLE_NEARBY: 100,
    MOVEMENT_AHEAD: 200,
    DESTINATION: 300,
    VISIBLE: 400,
    INITIAL_VIEWPORT: 500
});

/** Bounded loader for each logical segment's selected raster representation. */
export class ArtworkSegmentScheduler {
    #artwork;
    #segments;
    #fetchSegment;
    #decodeSegment;
    #maximumRequests;
    #maximumDecodes;
    #activeRequests = 0;
    #activeDecodes = 0;
    #sequence = 0;
    #listeners = new Set();

    constructor({
        artwork,
        fetchSegment = fetchArtworkSegment,
        decodeSegment = decodeArtworkSegment,
        maximumRequests = 3,
        maximumDecodes = 2
    }) {
        if (!artwork
            || !Number.isInteger(maximumRequests)
            || maximumRequests < 1
            || !Number.isInteger(maximumDecodes)
            || maximumDecodes < 1) {
            throw new TypeError("Artwork segment scheduler configuration is invalid.");
        }

        this.#artwork = artwork;
        this.#fetchSegment = fetchSegment;
        this.#decodeSegment = decodeSegment;
        this.#maximumRequests = maximumRequests;
        this.#maximumDecodes = maximumDecodes;
        this.#segments = artwork.segmentDescriptors().map((descriptor) => ({
            ...descriptor,
            state: SegmentLoadState.KNOWN,
            priority: SegmentPriority.BACKGROUND,
            sequence: null,
            payload: null,
            error: null
        }));
    }

    get segmentCount() {
        return this.#segments.length;
    }

    stateAt(index) {
        return this.#segmentAt(index).state;
    }

    errorAt(index) {
        return this.#segmentAt(index).error;
    }

    onStateChange(listener) {
        if (typeof listener !== "function") {
            throw new TypeError("Segment listener must be a function.");
        }
        this.#listeners.add(listener);
        return () => this.#listeners.delete(listener);
    }

    request(indices, priority = SegmentPriority.BACKGROUND) {
        const requested = uniqueIndices(indices, this.#segments.length);
        for (const index of requested) {
            const segment = this.#segments[index];
            if (isTerminal(segment.state)) {
                continue;
            }
            segment.priority = Math.max(segment.priority, priority);
            if (segment.state === SegmentLoadState.KNOWN) {
                segment.state = SegmentLoadState.QUEUED;
                segment.sequence = this.#sequence;
                this.#sequence += 1;
                this.#notify(segment);
            }
        }
        this.#pumpRequests();
        this.#pumpDecodes();
        return this.whenSettled(requested);
    }

    requestRemaining(priority = SegmentPriority.BACKGROUND) {
        return this.request(
            this.#segments.map(({ index }) => index),
            priority
        );
    }

    reprioritize(groups) {
        if (!Array.isArray(groups)) {
            throw new TypeError("Artwork priority groups must be an array.");
        }
        for (const segment of this.#segments) {
            if (segment.state === SegmentLoadState.QUEUED
                || segment.state === SegmentLoadState.LOADED) {
                segment.priority = SegmentPriority.BACKGROUND;
            }
        }
        for (const { indices, priority } of groups) {
            const requested = uniqueIndices(indices, this.#segments.length);
            for (const index of requested) {
                const segment = this.#segments[index];
                if (isTerminal(segment.state)
                    || segment.state === SegmentLoadState.REQUESTED
                    || segment.state === SegmentLoadState.DECODING) {
                    continue;
                }
                segment.priority = Math.max(segment.priority, priority);
                if (segment.state === SegmentLoadState.KNOWN) {
                    segment.state = SegmentLoadState.QUEUED;
                    segment.sequence = this.#sequence;
                    this.#sequence += 1;
                    this.#notify(segment);
                }
            }
        }
        this.#pumpRequests();
        this.#pumpDecodes();
    }

    whenSettled(indices) {
        const requested = uniqueIndices(indices, this.#segments.length);
        if (requested.every((index) => isTerminal(
            this.#segments[index].state
        ))) {
            return Promise.resolve(this.#resultFor(requested));
        }

        return new Promise((resolve) => {
            const unsubscribe = this.onStateChange(() => {
                if (!requested.every((index) => isTerminal(
                    this.#segments[index].state
                ))) {
                    return;
                }
                unsubscribe();
                resolve(this.#resultFor(requested));
            });
        });
    }

    #pumpRequests() {
        while (this.#activeRequests < this.#maximumRequests) {
            const segment = nextSegment(
                this.#segments,
                SegmentLoadState.QUEUED
            );
            if (!segment) {
                return;
            }
            this.#request(segment);
        }
    }

    async #request(segment) {
        this.#activeRequests += 1;
        segment.state = SegmentLoadState.REQUESTED;
        this.#notify(segment);
        try {
            segment.payload = await this.#fetchSegment(segment);
            segment.state = SegmentLoadState.LOADED;
            this.#notify(segment);
        } catch (error) {
            this.#fail(segment, error);
        } finally {
            this.#activeRequests -= 1;
            this.#pumpRequests();
            this.#pumpDecodes();
        }
    }

    #pumpDecodes() {
        while (this.#activeDecodes < this.#maximumDecodes) {
            const segment = nextSegment(
                this.#segments,
                SegmentLoadState.LOADED
            );
            if (!segment) {
                return;
            }
            this.#decode(segment);
        }
    }

    async #decode(segment) {
        this.#activeDecodes += 1;
        segment.state = SegmentLoadState.DECODING;
        this.#notify(segment);
        try {
            const source = await this.#decodeSegment(
                segment.payload,
                segment
            );
            this.#artwork.setSegmentSource(segment.index, source);
            segment.payload = null;
            segment.state = SegmentLoadState.DECODED;
            this.#notify(segment);
        } catch (error) {
            this.#fail(segment, error);
        } finally {
            this.#activeDecodes -= 1;
            this.#pumpDecodes();
        }
    }

    #fail(segment, error) {
        segment.payload = null;
        segment.error = error instanceof Error
            ? error
            : new Error(String(error));
        segment.state = SegmentLoadState.FAILED;
        console.error(
            `SIMONE could not load artwork segment "${segment.name}" `
            + `(${segment.representationLabel}).`,
            segment.error
        );
        this.#notify(segment);
    }

    #notify(segment) {
        const event = Object.freeze({
            index: segment.index,
            representationId: segment.representationId,
            state: segment.state,
            error: segment.error
        });
        for (const listener of this.#listeners) {
            listener(event);
        }
    }

    #resultFor(indices) {
        return Object.freeze({
            decoded: Object.freeze(indices.filter((index) => (
                this.#segments[index].state === SegmentLoadState.DECODED
            ))),
            failed: Object.freeze(indices.filter((index) => (
                this.#segments[index].state === SegmentLoadState.FAILED
            )))
        });
    }

    #segmentAt(index) {
        if (!Number.isInteger(index) || !this.#segments[index]) {
            throw new RangeError("Artwork segment is outside the manifest.");
        }
        return this.#segments[index];
    }
}

async function fetchArtworkSegment(segment) {
    const response = await fetch(segment.url);
    if (!response.ok) {
        throw new Error(`Artwork request failed with ${response.status}.`);
    }
    return response.blob();
}

async function decodeArtworkSegment(blob) {
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    try {
        if (typeof image.decode === "function") {
            image.src = objectUrl;
            await image.decode();
        } else {
            const loaded = imageLoad(image);
            image.src = objectUrl;
            await loaded;
        }
        return image;
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
}

function imageLoad(image) {
    return new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error("Artwork image could not be decoded."));
    });
}

function nextSegment(segments, state) {
    return segments
        .filter((segment) => segment.state === state)
        .sort((first, second) => (
            second.priority - first.priority
            || first.sequence - second.sequence
        ))[0] ?? null;
}

function uniqueIndices(indices, segmentCount) {
    if (!Array.isArray(indices)
        || indices.some((index) => !Number.isInteger(index)
            || index < 0
            || index >= segmentCount)) {
        throw new RangeError("Artwork segment request is invalid.");
    }
    return [...new Set(indices)];
}

function isTerminal(state) {
    return state === SegmentLoadState.DECODED
        || state === SegmentLoadState.FAILED;
}
