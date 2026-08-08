import { ViewingSurface } from "../src/viewport/ViewingSurface.js";
import {
    ViewportCanvasColumnRenderer
} from "../src/rendering/ViewportCanvasColumnRenderer.js";
import {
    lowerAnchoredTop,
    structuralSliceHeight
} from "../src/rendering/StructuralSliceProjection.js";
import { CircularFoldSurface } from "../src/geometry/CircularFoldSurface.js";
import { CurtainField } from "../src/surface/CurtainField.js";
import { SurfaceParameters } from "../src/surface/SurfaceParameters.js";
import { SurfaceShading } from "../src/shading/SurfaceShading.js";
import { Viewport } from "../src/viewport/Viewport.js";
import {
    inertiaPriorityCorridor,
    panPriorityCorridor,
    predictedInertialCameraTravel
} from "../src/application/ViewportApplication.js";

const tests = [];

test("portrait uses a narrower camera extent at the same visual scale", () => {
    const fixture = createViewingSurface(400, 800);
    const viewing = fixture.surface.resolve(
        { width: 60_000, height: 2_600 },
        2_500
    );

    closeTo(viewing.projectedExtent, 1_250);
    fixture.remove();
});

test("landscape uses a wider camera extent at the same visual scale", () => {
    const fixture = createViewingSurface(800, 400);
    const viewing = fixture.surface.resolve(
        { width: 60_000, height: 2_600 },
        2_500
    );

    closeTo(viewing.projectedExtent, 5_000);
    fixture.remove();
});

test("camera extent follows a changed rendered container aspect", () => {
    const fixture = createViewingSurface(400, 800);
    const portrait = fixture.surface.resolve(
        { width: 60_000, height: 2_600 },
        2_500
    );
    fixture.container.style.width = "800px";
    fixture.container.style.height = "400px";
    const landscape = fixture.surface.resolve(
        { width: 60_000, height: 2_600 },
        2_500
    );

    closeTo(portrait.projectedExtent, 1_250);
    closeTo(landscape.projectedExtent, 5_000);
    fixture.remove();
});

test("renderer preserves an unchanged canvas backing store", () => {
    const canvas = document.createElement("canvas");
    const renderer = new ViewportCanvasColumnRenderer(canvas);
    const frame = { width: 400, height: 200 };
    const appearance = {
        rearDarkening: { color: [0, 0, 0] },
        crestHighlight: {},
        valleyShadow: {}
    };

    renderer.beginFrame(frame, appearance);
    const first = renderer.endFrame();
    renderer.beginFrame(frame, appearance);
    const second = renderer.endFrame();

    assert(first.backingStoreResized);
    assert(!second.backingStoreResized);
    assert(canvas.width === 400 && canvas.height === 200);
});

test("viewport sampling keeps the complete global Period model", () => {
    const field = new CurtainField({ resetCurtainState: 0.5 });
    const parameters = new SurfaceParameters();
    const surface = new CircularFoldSurface();
    field.configureFor(1200, 120);
    field.setVisibleFactorRange(4, 5, 0.8);
    field.resolve(parameters);
    surface.frameFor({ width: 1200, height: 400 }, field);
    const period = surface.periods[4];
    const windowStart = period.horizontalOffset + period.projectedOffset;
    const range = surface.samplingRangeForProjectedWindow(
        windowStart,
        windowStart + period.projectedWidth,
        2
    );

    assert(surface.periods.length === 10, "global Period count changed");
    assert(
        range.periodStart <= 2,
        `guarded start ${range.periodStart} excluded an expected Period`
    );
    assert(
        range.periodEnd >= 7,
        `guarded end ${range.periodEnd} excluded an expected Period`
    );
    assert(
        range.logicalStart === range.periodStart * 120,
        "logical sampling start lost its global Period coordinate"
    );
    assert(
        range.logicalEnd === range.periodEnd * 120,
        "logical sampling end lost its global Period coordinate"
    );
});

test("guarded sampling contains every column selected by the camera", () => {
    const field = new CurtainField({ resetCurtainState: 0.5 });
    const parameters = new SurfaceParameters();
    const surface = new CircularFoldSurface();
    field.configureFor(1200, 120);
    field.setVisibleFactorRange(4, 5, 0.8);
    field.resolve(parameters);
    surface.frameFor({ width: 1200, height: 400 }, field);
    const placements = Array.from({ length: 1200 }, (_, sourceX) =>
        surface.mapColumn({ sourceX }, field)
    );
    let fullLastWidth = 1;
    const projectedColumns = placements.map((placement, sourceX) => {
        const next = placements[sourceX + 1];
        const width = next && next.branch === placement.branch
            ? next.targetX - placement.targetX
            : fullLastWidth;
        if (width !== 0) {
            fullLastWidth = width;
        }
        return {
            placement,
            width
        };
    });
    const period = surface.periods[4];
    const windowStart = period.horizontalOffset + period.projectedOffset;
    const viewport = new Viewport({
        projectedOffset: windowStart,
        projectedExtent: period.projectedWidth,
        presentationExtent: 400
    });
    viewport.setProjectedContentRange(0, 2000);
    const selected = viewport.sourceRangeFor(projectedColumns);
    const sampling = surface.samplingRangeForProjectedWindow(
        windowStart,
        windowStart + period.projectedWidth,
        2
    );
    const guardedStart = Math.max(0, sampling.logicalStart - 1);
    const guardedEnd = Math.min(placements.length, sampling.logicalEnd + 1);
    const guardedColumns = new Array(placements.length);
    let lastWidth = 1;
    for (let sourceX = guardedStart; sourceX < guardedEnd; sourceX += 1) {
        const placement = surface.mapColumn({ sourceX }, field);
        const next = sourceX + 1 < guardedEnd
            ? surface.mapColumn({ sourceX: sourceX + 1 }, field)
            : null;
        const width = next && next.branch === placement.branch
            ? next.targetX - placement.targetX
            : lastWidth;
        if (width !== 0) {
            lastWidth = width;
        }
        guardedColumns[sourceX] = { placement, width };
    }

    assert(selected.start >= sampling.logicalStart);
    assert(selected.end <= sampling.logicalEnd);
    for (let sourceX = selected.start; sourceX < selected.end; sourceX += 1) {
        const direct = surface.mapColumn({ sourceX }, field);
        closeTo(direct.targetX, projectedColumns[sourceX].placement.targetX);
        closeTo(direct.targetY, projectedColumns[sourceX].placement.targetY);
        closeTo(
            direct.localSlope,
            projectedColumns[sourceX].placement.localSlope
        );
        closeTo(
            guardedColumns[sourceX].width,
            projectedColumns[sourceX].width
        );
    }
});

test("depth values remain available without affecting strip height", () => {
    for (const visibleFactor of [0.5, 0.75, 1]) {
        const placements = foldPlacements(visibleFactor);
        const crest = placements.reduce((closest, placement) => (
            placement.depthFromFront < closest.depthFromFront
                ? placement
                : closest
        ));

        closeTo(crest.depthFromFront, 0, 1e-9);
    }
});

test("per-period h is computed from maximum targetY and not depthFromFront", () => {
    const placements = foldPlacements(0.75);
    const periodMax = Math.max(...placements.map((p) => p.periodMaximumTargetY));

    for (const placement of placements) {
        const h = periodMax - placement.targetY;
        const canonicalH = placement.periodMaximumTargetY - placement.targetY;
        const destinationHeight = structuralSliceHeight(
            800,
            placement.targetY,
            placement.periodMaximumTargetY
        );

        closeTo(h, canonicalH, 1e-9);
        closeTo(destinationHeight, 800 - 2 * h, 1e-9);
        assert(h >= 0, "h must be non-negative");
        if (placement.targetY === periodMax) {
            closeTo(h, 0, 1e-9);
        }
    }
});

test("flat state restores full height via period maximum targetY", () => {
    const placements = foldPlacements(1);
    const periodMax = Math.max(...placements.map((p) => p.periodMaximumTargetY));

    for (const placement of placements) {
        closeTo(placement.targetY, periodMax, 1e-9);
        closeTo(structuralSliceHeight(
            800,
            placement.targetY,
            placement.periodMaximumTargetY
        ), 800, 1e-9);
    }
});

test("front/rear boundary height remains continuous", () => {
    const placements = foldPlacements(0.75);
    for (let i = 1; i < placements.length; i += 1) {
        const prev = placements[i - 1];
        const current = placements[i];
        const prevHeight = structuralSliceHeight(
            800,
            prev.targetY,
            prev.periodMaximumTargetY
        );
        const currentHeight = structuralSliceHeight(
            800,
            current.targetY,
            current.periodMaximumTargetY
        );
        closeTo(prevHeight, currentHeight, 30); // allow coarse slope but no jump
    }
});

test("front branch lower profile is a U-shape and rear branch is inverted", () => {
    const placements = foldPlacements(0.75);
    const front = placements.filter((placement) => placement.branch === "front");
    const rear = placements.filter((placement) => placement.branch === "rear");

    assert(front.length > 0);
    assert(rear.length > 0);

    const frontFirst = front[0].targetY;
    const frontLast = front[front.length - 1].targetY;
    const frontMiddle = front[Math.floor((front.length - 1) / 2)].targetY;
    assert(frontMiddle > frontFirst, "Front profile must rise toward the center");
    assert(frontMiddle > frontLast, "Front profile must rise toward the center");

    const rearFirst = rear[0].targetY;
    const rearLast = rear[rear.length - 1].targetY;
    const rearMiddle = rear[Math.floor((rear.length - 1) / 2)].targetY;
    assert(rearMiddle < rearFirst, "Rear profile must invert relative to the front");
    assert(rearMiddle < rearLast, "Rear profile must invert relative to the front");
});

test("front/rear branch boundary slope and targetY are continuous", () => {
    const placements = foldPlacements(0.75);
    const boundaryIndex = placements.findIndex((placement, index) => (
        index > 0
            && placement.branch === "rear"
            && placements[index - 1].branch === "front"
    ));

    assert(boundaryIndex > 0, "Expected a front/rear boundary in the Period");
    const previous = placements[boundaryIndex - 1];
    const current = placements[boundaryIndex];

    closeTo(previous.targetY, current.targetY, 1.0);
    closeTo(previous.localSlope, current.localSlope, 0.5);
    assert(previous.branch === "front" && current.branch === "rear");
});

test("shading path remains active with branch and crest cues", () => {
    const canvas = document.createElement("canvas");
    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = 1;
    sourceCanvas.height = 1;
    sourceCanvas.getContext("2d").fillRect(0, 0, 1, 1);
    const renderer = new ViewportCanvasColumnRenderer(canvas);
    const frame = { width: 100, height: 100 };
    const appearance = {
        rearDarkening: { color: [0, 0, 0] },
        crestHighlight: {
            color: [255, 255, 255],
            strength: 1,
            stops: [
                { offset: 0, intensity: 0 },
                { offset: 0.5, intensity: 1 },
                { offset: 1, intensity: 0 }
            ]
        },
        valleyShadow: {
            color: [0, 0, 0],
            strength: 0.5,
            stops: [
                { offset: 0, intensity: 0 },
                { offset: 1, intensity: 1 }
            ]
        }
    };

    renderer.beginFrame(frame, appearance);
    renderer.drawColumn(
        {
            source: sourceCanvas,
            sourceX: 0,
            sourceY: 0,
            width: 1,
            height: 1
        },
        { x: 0, y: 0, width: 10, height: 100 },
        {
            brightness: 0.5,
            alpha: 1,
            branch: "front",
            localSlope: 0.1,
            foldProgress: 0.5,
            crestLifecycleMultiplier: 0.5
        }
    );
    const metrics = renderer.endFrame();

    assert(metrics !== null && metrics !== undefined);
});

test("renderer groups a continuous front branch into a single fold region", () => {
    const canvas = document.createElement("canvas");
    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = 1;
    sourceCanvas.height = 1;
    const column = {
        source: sourceCanvas,
        sourceX: 0,
        sourceY: 0,
        width: 1,
        height: 1
    };
    const renderer = new ViewportCanvasColumnRenderer(canvas);
    const frame = { width: 200, height: 200 };
    const appearance = {
        rearDarkening: { color: [0, 0, 0] },
        crestHighlight: {
            color: [255, 255, 255],
            strength: 1,
            stops: [
                { offset: 0, intensity: 0 },
                { offset: 0.5, intensity: 1 },
                { offset: 1, intensity: 0 }
            ]
        },
        valleyShadow: {
            color: [0, 0, 0],
            strength: 0.5,
            stops: [
                { offset: 0, intensity: 0 },
                { offset: 1, intensity: 1 }
            ]
        }
    };

    renderer.beginFrame(frame, appearance);

    // Simulate three adjacent columns on the front branch with an internal
    // slope-sign reversal (positive, negative, positive). They must be
    // considered one coherent fold region for shading.
    renderer.drawColumn(column, { x: 0, y: 0, width: 20, height: 100 }, {
        brightness: 1,
        alpha: 1,
        branch: "front",
        localSlope: 0.5,
        foldProgress: 0.5,
        crestLifecycleMultiplier: 1
    });

    renderer.drawColumn(column, { x: 20, y: 10, width: 20, height: 100 }, {
        brightness: 1,
        alpha: 1,
        branch: "front",
        localSlope: -0.5,
        foldProgress: 0.5,
        crestLifecycleMultiplier: 1
    });

    renderer.drawColumn(column, { x: 40, y: 0, width: 20, height: 100 }, {
        brightness: 1,
        alpha: 1,
        branch: "front",
        localSlope: 0.5,
        foldProgress: 0.5,
        crestLifecycleMultiplier: 1
    });

    renderer.endFrame();
    const regions = renderer.getDebugRegions();
    assert(regions.foldRegions.length === 1, "Front branch must form one fold region");
    assert(regions.foldRegions[0].branch === "front");
});

test("renderer keeps a Rear branch continuous across its zero-slope crossing", () => {
    const canvas = document.createElement("canvas");
    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = 1;
    sourceCanvas.height = 1;
    const renderer = new ViewportCanvasColumnRenderer(canvas);
    const column = {
        source: sourceCanvas,
        sourceX: 0,
        sourceY: 0,
        width: 1,
        height: 1
    };

    renderer.beginFrame({ width: 60, height: 100 }, cueTestAppearance());
    for (const [x, localSlope] of [[0, -0.5], [20, 0], [40, 0.5]]) {
        renderer.drawColumn(column, { x, y: 0, width: 20, height: 100 }, {
            ...cueColumnAppearance("rear"),
            periodIndex: 7,
            localSlope
        });
    }
    renderer.endFrame();

    const regions = renderer.getDebugRegions();
    const rearRegions = regions.foldRegions.filter(
        (region) => region.branch === "rear"
    );
    const rearShadows = regions.cueApplications.valleyShadows.filter(
        (region) => region.branch === "rear"
    );
    assert(rearRegions.length === 1);
    assert(rearRegions[0].left === 0 && rearRegions[0].right === 60);
    assert(rearRegions[0].ridgeX === 30);
    assert(rearShadows.length === 1);
    assert(rearShadows[0].left === 0 && rearShadows[0].right === 60);
    assert(
        rearRegions[0].ridgeX !== rearShadows[0].left
            && rearRegions[0].ridgeX !== rearShadows[0].right,
        "Rear zero-slope position must not be a maximum-strength gradient edge"
    );
});

test("renderer separates otherwise continuous Rear branches by Period", () => {
    const canvas = document.createElement("canvas");
    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = 1;
    sourceCanvas.height = 1;
    const renderer = new ViewportCanvasColumnRenderer(canvas);
    const column = {
        source: sourceCanvas,
        sourceX: 0,
        sourceY: 0,
        width: 1,
        height: 1
    };

    renderer.beginFrame({ width: 40, height: 100 }, cueTestAppearance());
    renderer.drawColumn(column, { x: 0, y: 0, width: 20, height: 100 }, {
        ...cueColumnAppearance("rear"),
        periodIndex: 3,
        localSlope: -0.5
    });
    renderer.drawColumn(column, { x: 20, y: 0, width: 20, height: 100 }, {
        ...cueColumnAppearance("rear"),
        periodIndex: 4,
        localSlope: 0.5
    });
    renderer.endFrame();

    const rearRegions = renderer.getDebugRegions().foldRegions.filter(
        (region) => region.branch === "rear"
    );
    assert(rearRegions.length === 2);
    assert(rearRegions[0].periodIndex === 3);
    assert(rearRegions[1].periodIndex === 4);
});

test("branch change still creates separate fold regions", () => {
    const canvas = document.createElement("canvas");
    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = 1;
    sourceCanvas.height = 1;
    const column = {
        source: sourceCanvas,
        sourceX: 0,
        sourceY: 0,
        width: 1,
        height: 1
    };
    const renderer = new ViewportCanvasColumnRenderer(canvas);
    const frame = { width: 200, height: 200 };
    const appearance = {
        rearDarkening: { color: [0, 0, 0] },
        crestHighlight: {
            color: [255, 255, 255],
            strength: 1,
            stops: [
                { offset: 0, intensity: 0 },
                { offset: 0.5, intensity: 1 },
                { offset: 1, intensity: 0 }
            ]
        },
        valleyShadow: {
            color: [0, 0, 0],
            strength: 0.5,
            stops: [
                { offset: 0, intensity: 0 },
                { offset: 1, intensity: 1 }
            ]
        }
    };

    renderer.beginFrame(frame, appearance);
    // Front column
    renderer.drawColumn(column, { x: 0, y: 0, width: 20, height: 100 }, {
        brightness: 1,
        alpha: 1,
        branch: "front",
        localSlope: 0.5,
        foldProgress: 0.5,
        crestLifecycleMultiplier: 1
    });

    // Rear column immediately following should create a new region
    renderer.drawColumn(column, { x: 20, y: 10, width: 20, height: 100 }, {
        brightness: 1,
        alpha: 1,
        branch: "rear",
        localSlope: -0.5,
        foldProgress: 0.5,
        crestLifecycleMultiplier: 1
    });

    renderer.endFrame();
    const regions = renderer.getDebugRegions();
    // Expect two regions: one front and one rear
    assert(regions.foldRegions.length >= 2);
    assert(regions.foldRegions[0].branch === "front");
    assert(regions.foldRegions[regions.foldRegions.length - 1].branch === "rear");
});

test("a non-drawable rear branch closes the preceding front cue region", () => {
    for (const rearCase of [
        { width: 20, alpha: 0 },
        { width: 0, alpha: 1 }
    ]) {
        const canvas = document.createElement("canvas");
        const sourceCanvas = document.createElement("canvas");
        sourceCanvas.width = 1;
        sourceCanvas.height = 1;
        const column = {
            source: sourceCanvas,
            sourceX: 0,
            sourceY: 0,
            width: 1,
            height: 1
        };
        const renderer = new ViewportCanvasColumnRenderer(canvas);
        const appearance = cueTestAppearance();
        renderer.beginFrame({ width: 200, height: 200 }, appearance);
        renderer.drawColumn(column, { x: 0, y: 0, width: 20, height: 100 }, {
            ...cueColumnAppearance("front"),
            localSlope: 0
        });
        renderer.drawColumn(
            column,
            { x: 20, y: 0, width: rearCase.width, height: 100 },
            {
                ...cueColumnAppearance("rear"),
                alpha: rearCase.alpha
            }
        );
        renderer.drawColumn(column, { x: 40, y: 0, width: 20, height: 100 }, {
            ...cueColumnAppearance("front"),
            localSlope: 0
        });
        renderer.endFrame();

        const regions = renderer.getDebugRegions();
        const frontRegions = regions.foldRegions.filter(
            (region) => region.branch === "front"
        );
        assert(frontRegions.length === 2);
        assert(regions.cueApplications.crestHighlights.length === 2);
        assert(frontRegions[0].ridgeX !== frontRegions[1].ridgeX);
    }
});

test("Model 2 keeps physical front folds in distinct cue regions", () => {
    const regions = correctedFoldCueDiagnostics(0.5);
    const frontRegions = regions.foldRegions.filter(
        (region) => region.branch === "front"
    );
    const crestHighlights = regions.cueApplications.crestHighlights;

    assert(frontRegions.length === 2);
    assert(crestHighlights.length === 2);
    closeTo(frontRegions[0].left, 19);
    closeTo(frontRegions[0].right, 79);
    closeTo(frontRegions[1].left, 79);
    closeTo(frontRegions[1].right, 139);
    closeTo(frontRegions[0].ridgeX, 49.5);
    closeTo(frontRegions[1].ridgeX, 109.5);
});

test("Model 1 cue regions remain unchanged", () => {
    const regions = correctedFoldCueDiagnostics(0.75);
    const frontRegions = regions.foldRegions.filter(
        (region) => region.branch === "front"
    );

    assert(frontRegions.length === 2);
    assert(regions.rearRegions.length === 2);
    assert(regions.cueApplications.crestHighlights.length === 2);
    closeTo(frontRegions[0].left, 19);
    closeTo(frontRegions[0].right, 87);
    closeTo(frontRegions[1].left, 109);
    closeTo(frontRegions[1].right, 177);
    closeTo(frontRegions[0].ridgeX, 53.5);
    closeTo(frontRegions[1].ridgeX, 143.5);
});

test("physical depth remains available as a geometry diagnostic", () => {
    const folded = foldPlacements(0.75);
    const shallower = foldPlacements(0.9);
    const flat = foldPlacements(1);
    const foldedValley = deepestPlacement(folded);
    const shallowerValley = deepestPlacement(shallower);

    assert(
        foldedValley.depthFromFront > shallowerValley.depthFromFront,
        "Opening the fold did not reduce its physical depth"
    );
    for (const placement of flat) {
        closeTo(placement.depthFromFront, 0, 1e-9);
    }
});

test("physical depth remains continuous across fold branch boundaries", () => {
    const placements = foldPlacements(0.75);
    const referenceDepth = placements[0].referenceMaximumDepth;

    for (let index = 1; index < placements.length; index += 1) {
        assert(
            Math.abs(
                placements[index].depthFromFront
                    - placements[index - 1].depthFromFront
            ) / referenceDepth < 0.08,
            `Depth jumped between columns ${index - 1} and ${index}`
        );
    }
});

test("vertical-strip height equals original minus 2h invariants", () => {
    const folded = foldPlacements(0.75);
    const flat = foldPlacements(1);
    const periodMax = Math.max(...folded.map((p) => p.periodMaximumTargetY));
    const deepest = folded.reduce((candidate, placement) => (
        placement.targetY > candidate.targetY ? placement : candidate
    ), folded[0]);

    closeTo(deepest.targetY, periodMax, 1e-9);

    const L = 800;
    for (const placement of folded) {
        const h = periodMax - placement.targetY;
        assert(h >= 0, "h must be non-negative");
        const height = structuralSliceHeight(
            L,
            placement.targetY,
            placement.periodMaximumTargetY
        );
        assert(height > 0, "height must remain positive");
        closeTo(height, L - 2 * h, 1e-9);
    }

    for (const placement of flat) {
        closeTo(placement.targetY, placement.periodMaximumTargetY, 1e-9);
        closeTo(structuralSliceHeight(
            800,
            placement.targetY,
            placement.periodMaximumTargetY
        ), 800, 1e-9);
    }
});

test("structural slices remain attached to the authoritative lower fold", () => {
    const L = 800;
    for (const placement of foldPlacements(0.75)) {
        const height = structuralSliceHeight(
            L,
            placement.targetY,
            placement.periodMaximumTargetY
        );
        const top = lowerAnchoredTop(L, placement.targetY, height);
        closeTo(top + height, placement.targetY + L, 1e-9);

        const scaledHeight = structuralSliceHeight(
            L,
            placement.targetY,
            placement.periodMaximumTargetY,
            2
        );
        const scaledTop = lowerAnchoredTop(
            L,
            placement.targetY,
            scaledHeight,
            2
        );
        closeTo(
            scaledTop + scaledHeight,
            (placement.targetY + L) * 2,
            1e-9
        );
    }
});

test("Pan priority corridor follows direction and reverses immediately", () => {
    const right = panPriorityCorridor(1000, 400, 20);
    const left = panPriorityCorridor(1000, 400, -20);

    assert(right.start === 1000 && right.end === 1800);
    assert(left.start === 600 && left.end === 1400);
});

test("inertia priority predicts the damped travel corridor", () => {
    const travel = predictedInertialCameraTravel(-2, 1.75, 4);
    const corridor = inertiaPriorityCorridor(1000, 400, travel, 2000);

    closeTo(travel, 875);
    closeTo(corridor.start, 1000);
    closeTo(corridor.end, 2275);
});

test("inertia priority respects the existing camera travel bound", () => {
    const corridor = inertiaPriorityCorridor(1000, 400, -2000, 300);

    closeTo(corridor.start, 700);
    closeTo(corridor.end, 1400);
});

function createViewingSurface(width, height) {
    const container = document.createElement("div");
    container.style.width = `${width}px`;
    container.style.height = `${height}px`;
    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    container.append(canvas);
    document.body.append(container);

    return {
        container,
        surface: new ViewingSurface(canvas),
        remove: () => container.remove()
    };
}

function cueTestAppearance() {
    return {
        rearDarkening: { color: [0, 0, 0] },
        crestHighlight: {
            color: [255, 255, 255],
            strength: 1,
            stops: [
                { offset: 0, intensity: 0 },
                { offset: 0.5, intensity: 1 },
                { offset: 1, intensity: 0 }
            ]
        },
        valleyShadow: {
            color: [0, 0, 0],
            strength: 0.5,
            stops: [
                { offset: 0, intensity: 0 },
                { offset: 1, intensity: 1 }
            ]
        }
    };
}

function cueColumnAppearance(branch) {
    return {
        brightness: 1,
        alpha: 1,
        branch,
        localSlope: 0.5,
        foldProgress: 0.5,
        crestLifecycleMultiplier: 1
    };
}

function foldPlacements(visibleFactor) {
    const field = new CurtainField({ resetCurtainState: visibleFactor });
    const parameters = new SurfaceParameters();
    const surface = new CircularFoldSurface();
    field.configureFor(240, 120);
    field.resolve(parameters);
    surface.frameFor({ width: 240, height: 400 }, field);
    return Array.from({ length: 120 }, (_, sourceX) => (
        surface.mapColumn({ sourceX }, field)
    ));
}

function deepestPlacement(placements) {
    return placements.reduce((deepest, placement) => (
        placement.depthFromFront > deepest.depthFromFront
            ? placement
            : deepest
    ));
}

function closeTo(actual, expected, tolerance = 1e-12) {
    assert(
        Math.abs(actual - expected) <= tolerance,
        `Expected ${actual} to equal ${expected}`
    );
}

function assert(condition, message = "Assertion failed") {
    if (!condition) {
        throw new Error(message);
    }
}

function test(name, body) {
    tests.push({ name, body });
}

function run() {
    const failures = [];

    for (const testCase of tests) {
        try {
            testCase.body();
        } catch (error) {
            failures.push(`${testCase.name}: ${error.message}`);
        }
    }

    const summary = failures.length === 0
        ? `PASS ${tests.length}/${tests.length}`
        : `FAIL ${tests.length - failures.length}/${tests.length}\n`
            + failures.join("\n");
    document.getElementById("results").textContent = summary;
    document.title = summary.split("\n")[0];
    console.log(summary);
}

run();

function correctedFoldCueDiagnostics(visibleFactor) {
    const field = new CurtainField({ resetCurtainState: visibleFactor });
    const parameters = new SurfaceParameters();
    const shading = new SurfaceShading();
    const surface = new CircularFoldSurface();
    field.configureFor(240, 120);
    field.resolve(parameters);
    const frame = surface.frameFor({ width: 240, height: 400 }, field);
    const placements = Array.from({ length: 240 }, (_, sourceX) => (
        surface.mapColumn({ sourceX }, field)
    ));
    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = 240;
    sourceCanvas.height = 400;
    const renderer = new ViewportCanvasColumnRenderer(
        document.createElement("canvas")
    );
    renderer.beginFrame(frame, shading.appearanceFor());

    let lastWidth = 1;
    for (let sourceX = 0; sourceX < placements.length; sourceX += 1) {
        const placement = placements[sourceX];
        const next = placements[sourceX + 1];
        const width = next && next.branch === placement.branch
            ? next.targetX - placement.targetX
            : lastWidth;
        if (width !== 0) {
            lastWidth = width;
        }
        const height = structuralSliceHeight(
            400,
            placement.targetY,
            placement.periodMaximumTargetY
        );
        const localParameters = field.resolvedParametersAt(
            placement.periodIndex
        );
        renderer.drawColumn(
            {
                source: sourceCanvas,
                sourceX,
                sourceY: 0,
                width: 1,
                height: 400
            },
            {
                x: placement.targetX,
                y: lowerAnchoredTop(400, placement.targetY, height),
                width,
                height
            },
            {
                brightness: shading.factorFor(
                    placement,
                    localParameters
                ),
                alpha: placement.alpha,
                branch: placement.branch,
                periodIndex: placement.periodIndex,
                localSlope: placement.localSlope,
                foldProgress: localParameters.foldProgress,
                crestLifecycleMultiplier:
                    shading.crestLifecycleFor(localParameters)
            }
        );
    }

    renderer.endFrame();
    return renderer.getDebugRegions();
}
