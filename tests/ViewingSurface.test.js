import { ViewingSurface } from "../src/viewport/ViewingSurface.js";
import {
    ViewportCanvasColumnRenderer
} from "../src/rendering/ViewportCanvasColumnRenderer.js";
import { CircularFoldSurface } from "../src/geometry/CircularFoldSurface.js";
import { CurtainField } from "../src/surface/CurtainField.js";
import { SurfaceParameters } from "../src/surface/SurfaceParameters.js";
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

function closeTo(actual, expected) {
    assert(
        Math.abs(actual - expected) <= 1e-12,
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
