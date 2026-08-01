import {
    imageFilenamesFromManifest,
    imageSourcesForFilenames,
    manifestUrlFor
} from "../src/application/startSimone.js";
import { loadArtwork } from "../src/artwork/loadArtwork.js";
import { ImmutableArtwork } from "../src/artwork/ImmutableArtwork.js";
import {
    artworkSegmentsFromManifest
} from "../src/artwork/ArtworkManifest.js";
import {
    ArtworkSegmentScheduler,
    SegmentLoadState,
    SegmentPriority
} from "../src/artwork/ArtworkSegmentScheduler.js";

const failures = [];
let assertionCount = 0;
const filenames = imageFilenamesFromManifest([
    "# Curtain artwork",
    "",
    "Exposition été.jpg",
    "Exposition été 2.jpg",
    "   ",
    "# ignored.jpg",
    "Exposition été 12.jpg"
].join("\n"));

const expected = [
    "Exposition été.jpg",
    "Exposition été 2.jpg",
    "Exposition été 12.jpg"
];
check(
    filenames.length === expected.length
    && filenames.every((filename, index) => filename === expected[index]),
    "manifest order or filename preservation changed"
);
const sources = imageSourcesForFilenames(
    ["Exposition été 12.jpg"],
    "https://example.test/simone/"
);
check(
    sources[0].url
        === "https://example.test/simone/public/images/Exposition%20%C3%A9t%C3%A9%2012.jpg",
    "image URL did not preserve the application base path"
);
check(
    manifestUrlFor("public/projects.txt", "http://localhost:8000/")
        .searchParams.has("t"),
    "development manifest URL was not cache-busted"
);
check(
    !manifestUrlFor("public/projects.txt", "https://example.test/simone/")
        .searchParams.has("t"),
    "production manifest URL was unexpectedly cache-busted"
);

const originalConsoleError = console.error;
const loggedErrors = [];
console.error = (...values) => loggedErrors.push(values);

try {
    const artwork = await loadArtwork([
        imageSource("Première image.svg", 3, 2),
        { name: "Image cassée.svg", url: "data:image/svg+xml,not-svg" },
        imageSource("Troisième image.svg", 5, 4)
    ]);
    check(artwork.width === 8, "virtual artwork width is not continuous");
    check(artwork.height === 4, "different source heights were not preserved");
    check(artwork.imageCount === 2, "successful source count changed");
    const firstLastColumn = artwork.columnAt(2);
    const secondFirstColumn = artwork.columnAt(3);
    check(
        firstLastColumn.source !== secondFirstColumn.source,
        "segment boundary did not switch decoded sources"
    );
    check(firstLastColumn.sourceX === 2, "first source coordinate changed");
    check(secondFirstColumn.sourceX === 0, "second source did not start at zero");
    check(
        firstLastColumn.artworkX === 2 && secondFirstColumn.artworkX === 3,
        "continuous virtual coordinates changed at a segment boundary"
    );
    check(
        firstLastColumn.height === 2 && secondFirstColumn.height === 4,
        "individual source heights were not preserved"
    );
    check(
        artwork.columnAt(2) === firstLastColumn,
        "immutable column descriptor was recreated"
    );
    check(
        loggedErrors.some((values) => String(values[0])
            .includes("Image cassée.svg")),
        "failed image filename was not reported"
    );
} finally {
    console.error = originalConsoleError;
}

const metadata = artworkSegmentsFromManifest(JSON.stringify({
    version: 1,
    segments: [
        { src: "First image.jpg", width: 3, height: 2, byteSize: 100 },
        { src: "Second image.jpg", width: 5, height: 4 }
    ]
}), "https://example.test/simone/");
check(metadata.length === 2, "structured metadata segment count changed");
check(
    metadata[1].url
        === "https://example.test/simone/public/images/Second%20image.jpg",
    "structured metadata URL resolution changed"
);
check(
    metadata[0].width === 3
        && metadata[0].height === 2
        && metadata[0].byteSize === 100,
    "structured metadata dimensions or byte size changed"
);
let invalidMetadataRejected = false;
try {
    artworkSegmentsFromManifest(JSON.stringify({
        version: 1,
        segments: [
            { src: "Broken.jpg", width: 0, height: 2 }
        ]
    }), "https://example.test/simone/");
} catch {
    invalidMetadataRejected = true;
}
check(invalidMetadataRejected, "invalid artwork metadata was accepted");

const metadataArtwork = ImmutableArtwork.fromMetadata(metadata);
check(
    metadataArtwork.width === 8
        && metadataArtwork.height === 4
        && metadataArtwork.imageCount === 2,
    "metadata-only artwork did not establish global dimensions"
);
check(
    metadataArtwork.columnAt(0) === null
        && metadataArtwork.segmentIndicesForSourceRange(2, 6).join(",")
            === "0,1",
    "metadata-only source range mapping changed"
);
const firstSource = canvasSource(3, 2);
const secondSource = canvasSource(5, 4);
metadataArtwork.setSegmentSource(0, firstSource);
metadataArtwork.setSegmentSource(1, secondSource);
const legacyArtwork = new ImmutableArtwork([firstSource, secondSource]);
check(
    metadataArtwork.allSegmentsDecoded
        && metadataArtwork.width === legacyArtwork.width
        && metadataArtwork.height === legacyArtwork.height,
    "decoded metadata artwork does not match legacy dimensions"
);
check(
    Array.from({ length: legacyArtwork.width }, (_, sourceX) => {
        const current = metadataArtwork.columnAt(sourceX);
        const previous = legacyArtwork.columnAt(sourceX);
        return current.source === previous.source
            && current.sourceX === previous.sourceX
            && current.artworkX === previous.artworkX
            && current.height === previous.height;
    }).every(Boolean),
    "decoded metadata artwork changed final column rendering descriptors"
);
check(
    metadataArtwork.logicalXForSourceX(4, 100)
        === legacyArtwork.logicalXForSourceX(4, 100)
        && metadataArtwork.sourceXForLogicalX(120, 100)
            === legacyArtwork.sourceXForLogicalX(120, 100),
    "metadata artwork coordinate conversion differs from the legacy model"
);

const schedulerMetadata = [
    segmentMetadata("Zero", 0),
    segmentMetadata("One", 1),
    segmentMetadata("Two", 2)
];
const scheduledArtwork = ImmutableArtwork.fromMetadata(schedulerMetadata);
const requestOrder = [];
const scheduler = new ArtworkSegmentScheduler({
    artwork: scheduledArtwork,
    maximumRequests: 1,
    maximumDecodes: 1,
    async fetchSegment(segment) {
        requestOrder.push(segment.index);
        await Promise.resolve();
        return canvasSource(segment.width, segment.height);
    },
    decodeSegment: async (source) => source
});
const background = scheduler.request([0, 1], SegmentPriority.BACKGROUND);
const initial = scheduler.request([2], SegmentPriority.INITIAL_VIEWPORT);
await Promise.all([background, initial]);
check(
    requestOrder.join(",") === "0,2,1",
    "queued initial viewport segment did not outrank background loading"
);
check(
    scheduler.stateAt(0) === SegmentLoadState.DECODED
        && scheduler.stateAt(1) === SegmentLoadState.DECODED
        && scheduler.stateAt(2) === SegmentLoadState.DECODED,
    "scheduler did not complete deterministic segment states"
);

const priorityArtwork = ImmutableArtwork.fromMetadata(
    Array.from({ length: 5 }, (_, index) => segmentMetadata(
        `Priority ${index}`,
        index
    ))
);
const priorityOrder = [];
let releaseFirstRequest;
const firstRequestBlocked = new Promise((resolve) => {
    releaseFirstRequest = resolve;
});
const priorityScheduler = new ArtworkSegmentScheduler({
    artwork: priorityArtwork,
    maximumRequests: 1,
    maximumDecodes: 1,
    async fetchSegment(segment) {
        priorityOrder.push(segment.index);
        if (segment.index === 0) {
            await firstRequestBlocked;
        }
        return canvasSource(segment.width, segment.height);
    },
    decodeSegment: async (source) => source
});
const allPriorities = priorityScheduler.requestRemaining();
priorityScheduler.reprioritize([{
    indices: [4],
    priority: SegmentPriority.MOVEMENT_AHEAD
}]);
priorityScheduler.reprioritize([
    { indices: [1], priority: SegmentPriority.MOVEMENT_AHEAD },
    { indices: [2], priority: SegmentPriority.VISIBLE }
]);
releaseFirstRequest();
await allPriorities;
check(
    priorityOrder.slice(0, 4).join(",") === "0,2,1,3",
    "visible work or reversed movement did not reprioritize queued segments"
);
check(
    priorityOrder.indexOf(4) > priorityOrder.indexOf(1),
    "stale movement direction remained prioritized after reversal"
);

const viewportArtwork = ImmutableArtwork.fromMetadata(schedulerMetadata);
const viewportRequests = [];
const viewportScheduler = new ArtworkSegmentScheduler({
    artwork: viewportArtwork,
    async fetchSegment(segment) {
        viewportRequests.push(segment.index);
        return canvasSource(segment.width, segment.height);
    },
    decodeSegment: async (source) => source
});
const initialRange = viewportArtwork.segmentIndicesForSourceRange(0, 4);
await viewportScheduler.request(
    initialRange,
    SegmentPriority.INITIAL_VIEWPORT
);
check(
    viewportRequests.join(",") === "0,1"
        && viewportArtwork.decodedSegmentCount === 2
        && viewportScheduler.stateAt(2) === SegmentLoadState.KNOWN,
    "viewport-first startup requested artwork outside its initial range"
);
await viewportScheduler.requestRemaining(SegmentPriority.BACKGROUND);
check(
    viewportArtwork.allSegmentsDecoded
        && viewportRequests.join(",") === "0,1,2",
    "background loading did not complete the exhibition"
);

const failingArtwork = ImmutableArtwork.fromMetadata(schedulerMetadata);
const failingScheduler = new ArtworkSegmentScheduler({
    artwork: failingArtwork,
    async fetchSegment(segment) {
        if (segment.index === 1) {
            throw new Error("Expected test failure");
        }
        return canvasSource(segment.width, segment.height);
    },
    decodeSegment: async (source) => source
});
console.error = () => {};
const failureResult = await failingScheduler.requestRemaining();
console.error = originalConsoleError;
check(
    failureResult.failed.join(",") === "1"
        && failingArtwork.width === 6
        && failingArtwork.height === 2
        && failingArtwork.columnAt(2) === null
        && failingArtwork.columnAt(4) !== null,
    "failed segment changed global geometry or blocked later artwork"
);

const passed = assertionCount - failures.length;
const summary = failures.length === 0
    ? `PASS ${assertionCount}/${assertionCount}`
    : `FAIL ${passed}/${assertionCount}\n${failures.join("\n")}`;

document.getElementById("results").textContent = summary;
document.title = summary.split("\n")[0];
console.log(summary);

function imageSource(name, width, height) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"></svg>`;
    return {
        name,
        url: `data:image/svg+xml,${encodeURIComponent(svg)}`
    };
}

function check(condition, message) {
    assertionCount += 1;
    if (!condition) {
        failures.push(message);
    }
}

function canvasSource(width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
}

function segmentMetadata(name, index) {
    return Object.freeze({
        name,
        url: `https://example.test/${index}.jpg`,
        width: 2,
        height: 2
    });
}
