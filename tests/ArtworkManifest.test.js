import {
    imageFilenamesFromManifest,
    imageSourcesForFilenames,
    manifestUrlFor
} from "../src/application/startSimone.js";
import { loadArtwork } from "../src/artwork/loadArtwork.js";
import { ImmutableArtwork } from "../src/artwork/ImmutableArtwork.js";
import {
    artworkRepresentationIdsFromManifest,
    artworkSegmentsFromManifest
} from "../src/artwork/ArtworkManifest.js";
import {
    ArtworkSegmentScheduler,
    SegmentLoadState,
    SegmentPriority
} from "../src/artwork/ArtworkSegmentScheduler.js";
import { CircularFoldSurface } from "../src/geometry/CircularFoldSurface.js";
import { createProjectNavigation } from "../src/navigation/ProjectNavigation.js";
import { ViewportCanvasColumnRenderer } from "../src/rendering/ViewportCanvasColumnRenderer.js";
import { CurtainField } from "../src/surface/CurtainField.js";
import { SurfaceParameters } from "../src/surface/SurfaceParameters.js";

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

const manifestSource = JSON.stringify({
    version: 2,
    segments: [
        {
            id: "First image",
            logicalWidth: 4,
            logicalHeight: 2,
            representations: [
                { id: "a", src: "source-a/First A.jpg", width: 4, height: 2, byteSize: 100 },
                { id: "b", src: "source-b/First B.jpg", width: 2, height: 1, byteSize: 50 }
            ]
        },
        {
            id: "Second image",
            logicalWidth: 4,
            logicalHeight: 2,
            representations: [
                { id: "a", src: "source-a/Second A.jpg", width: 4, height: 2, byteSize: 100 },
                { id: "b", src: "source-b/Second B.jpg", width: 2, height: 1, byteSize: 50 }
            ]
        }
    ]
});
const metadata = artworkSegmentsFromManifest(
    manifestSource,
    "https://example.test/simone/",
    "a"
);
check(metadata.length === 2, "structured metadata segment count changed");
check(
    metadata[1].url
        === "https://example.test/simone/public/images/source-a/Second%20A.jpg",
    "structured metadata URL resolution changed"
);
check(
    metadata[0].width === 4
        && metadata[0].height === 2
        && metadata[0].sourceWidth === 4
        && metadata[0].sourceHeight === 2
        && metadata[0].byteSize === 100
        && metadata[0].representationId === "a",
    "structured metadata dimensions or byte size changed"
);
check(
    artworkRepresentationIdsFromManifest(manifestSource).join(",") === "a,b",
    "common artwork representations were not discovered"
);
let invalidMetadataRejected = false;
try {
    artworkSegmentsFromManifest(JSON.stringify({
        version: 2,
        segments: [{
            id: "Broken",
            logicalWidth: 4,
            logicalHeight: 2,
            representations: [{
                id: "b",
                src: "Broken.jpg",
                width: 3,
                height: 1,
                byteSize: 10
            }]
        }]
    }), "https://example.test/simone/");
} catch {
    invalidMetadataRejected = true;
}
check(invalidMetadataRejected, "invalid artwork metadata was accepted");

const metadataArtwork = ImmutableArtwork.fromMetadata(metadata);
check(
    metadataArtwork.width === 8
        && metadataArtwork.height === 2
        && metadataArtwork.imageCount === 2,
    "metadata-only artwork did not establish global dimensions"
);
check(
    metadataArtwork.columnAt(0) === null
        && metadataArtwork.segmentIndicesForSourceRange(2, 6).join(",")
            === "0,1",
    "metadata-only source range mapping changed"
);
const firstSource = canvasSource(4, 2);
const secondSource = canvasSource(4, 2);
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

const halfResolutionMetadata = artworkSegmentsFromManifest(
    manifestSource,
    "https://example.test/simone/",
    "b"
);
const halfResolutionArtwork = ImmutableArtwork.fromMetadata(
    halfResolutionMetadata
);
halfResolutionArtwork.setSegmentSource(0, canvasSource(2, 1));
check(
    halfResolutionArtwork.width === 8
        && halfResolutionArtwork.height === 2,
    "half-resolution source changed authoritative artwork dimensions"
);
check(
    halfResolutionArtwork.columnAt(2).sourceX === 1
        && halfResolutionArtwork.columnAt(2).sourceWidth === 0.5
        && halfResolutionArtwork.columnAt(2).sourceHeight === 1
        && halfResolutionArtwork.columnAt(2).height === 2,
    "logical columns did not map to half-resolution bitmap coordinates"
);
check(
    halfResolutionArtwork.sourceDescription
        === "SOURCE B 2×1 / LOGICAL 4×2",
    "half-resolution source diagnostic is unclear"
);
let missingRepresentationRejected = false;
try {
    artworkSegmentsFromManifest(
        manifestSource,
        "https://example.test/simone/",
        "missing"
    );
} catch (error) {
    missingRepresentationRejected = String(error.message).includes("missing");
}
check(
    missingRepresentationRejected,
    "a missing selected representation was not reported clearly"
);

const parityManifest = JSON.stringify({
    version: 2,
    segments: [{
        id: "Parity segment",
        logicalWidth: 5000,
        logicalHeight: 2500,
        representations: [
            {
                id: "a",
                src: "Parity A.jpg",
                width: 5000,
                height: 2500,
                byteSize: 1
            },
            {
                id: "b",
                src: "Parity B.jpg",
                width: 2500,
                height: 1250,
                byteSize: 1
            }
        ]
    }]
});
const sourceAArtwork = decodedRepresentation(parityManifest, "a");
const sourceBArtwork = decodedRepresentation(parityManifest, "b");
const sourceADescriptor = sourceAArtwork.segmentDescriptors()[0];
const sourceBDescriptor = sourceBArtwork.segmentDescriptors()[0];
check(
    sourceAArtwork.width === 5000
        && sourceBArtwork.width === 5000
        && sourceAArtwork.height === 2500
        && sourceBArtwork.height === 2500
        && sourceAArtwork.columnAt(4999).artworkX === 4999
        && sourceBArtwork.columnAt(4999).artworkX === 4999,
    "raster representation changed logical column identity or artwork extent"
);
check(
    sourceADescriptor.sourceStart === sourceBDescriptor.sourceStart
        && sourceADescriptor.width === sourceBDescriptor.width
        && sourceAArtwork.segmentIndicesForSourceRange(0, 5000).join(",")
            === sourceBArtwork.segmentIndicesForSourceRange(0, 5000).join(","),
    "raster representation changed the global logical segment range"
);
check(
    sourceAArtwork.columnAt(2000).sourceX === 2000
        && sourceAArtwork.columnAt(2000).sourceWidth === 1
        && sourceBArtwork.columnAt(2000).sourceX === 1000
        && sourceBArtwork.columnAt(2000).sourceWidth === 0.5,
    "representation parity changed something other than raster sampling"
);
let decodedDimensionMismatchRejected = false;
try {
    sourceBArtwork.setSegmentSource(0, canvasSource(5000, 2500));
} catch {
    decodedDimensionMismatchRejected = true;
}
check(
    decodedDimensionMismatchRejected,
    "selected representation accepted incorrect decoded raster dimensions"
);

const sourceAPlacement = representativePlacement(sourceAArtwork, 2000);
const sourceBPlacement = representativePlacement(sourceBArtwork, 2000);
check(
    placementValues(sourceAPlacement) === placementValues(sourceBPlacement),
    "raster representation changed Period placement"
);
const sourceANavigation = createProjectNavigation({
    source: "First,3\nSecond,2",
    loadedImageCount: sourceAArtwork.imageCount
});
const sourceBNavigation = createProjectNavigation({
    source: "First,3\nSecond,2",
    loadedImageCount: sourceBArtwork.imageCount
});
check(
    JSON.stringify(sourceANavigation.projects)
        === JSON.stringify(sourceBNavigation.projects)
        && sourceAArtwork.sourceXForLogicalX(2200, 4400)
            === sourceBArtwork.sourceXForLogicalX(2200, 4400),
    "raster representation changed project or viewport navigation targets"
);
check(
    normalDrawCountFor(sourceAArtwork)
        === normalDrawCountFor(sourceBArtwork),
    "raster representation changed the normal logical-column draw count"
);
const scheduledSourceBArtwork = ImmutableArtwork.fromMetadata(
    artworkSegmentsFromManifest(
        parityManifest,
        "https://example.test/simone/",
        "b"
    )
);
let scheduledRepresentation = null;
const representationScheduler = new ArtworkSegmentScheduler({
    artwork: scheduledSourceBArtwork,
    async fetchSegment(segment) {
        scheduledRepresentation = {
            id: segment.representationId,
            url: segment.url,
            width: segment.sourceWidth,
            height: segment.sourceHeight
        };
        return canvasSource(segment.sourceWidth, segment.sourceHeight);
    },
    decodeSegment: async (source) => source
});
await representationScheduler.request([0], SegmentPriority.INITIAL_VIEWPORT);
check(
    scheduledRepresentation.id === "b"
        && scheduledRepresentation.url.endsWith("Parity%20B.jpg")
        && scheduledRepresentation.width === 2500
        && scheduledRepresentation.height === 1250
        && scheduledSourceBArtwork.allSegmentsDecoded,
    "scheduler did not fetch and decode the selected raster representation"
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

function decodedRepresentation(manifest, id) {
    const representationMetadata = artworkSegmentsFromManifest(
        manifest,
        "https://example.test/simone/",
        id
    );
    const artwork = ImmutableArtwork.fromMetadata(representationMetadata);
    artwork.setSegmentSource(0, canvasSource(
        representationMetadata[0].sourceWidth,
        representationMetadata[0].sourceHeight
    ));
    return artwork;
}

function representativePlacement(artwork, sourceX) {
    const parameters = new SurfaceParameters();
    const field = new CurtainField();
    field.configureFor(4400, parameters.carrierDistance);
    field.resolve(parameters);
    const surface = new CircularFoldSurface();
    surface.frameFor({ width: 4400, height: artwork.height }, field);
    return surface.mapColumn({
        sourceX: artwork.logicalXForSourceX(sourceX, 4400)
    }, field);
}

function placementValues(placement) {
    return [
        placement.sourceX,
        placement.periodIndex,
        placement.targetX,
        placement.targetY,
        placement.branch,
        placement.alpha
    ].join("|");
}

function normalDrawCountFor(artwork) {
    const columnCount = 100;
    const renderer = new ViewportCanvasColumnRenderer(
        document.createElement("canvas")
    );
    renderer.beginFrame({ width: columnCount, height: 10 }, {
        rearDarkening: { color: [0, 0, 0] },
        crestHighlight: {
            color: [255, 255, 255],
            strength: 0,
            stops: []
        },
        valleyShadow: {
            color: [0, 0, 0],
            strength: 0,
            stops: []
        }
    });
    for (let sourceX = 0; sourceX < columnCount; sourceX += 1) {
        renderer.drawColumn(artwork.columnAt(sourceX), {
            x: sourceX,
            y: 0,
            width: 1,
            height: 10
        }, {
            brightness: 1,
            alpha: 1,
            branch: "front",
            periodIndex: 0,
            localSlope: 0,
            foldProgress: 0,
            crestLifecycleMultiplier: 0
        });
    }
    return renderer.endFrame().drawImageCalls;
}
