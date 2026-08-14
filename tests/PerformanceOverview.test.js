import {
    FramePerformanceOverview
} from "../src/performance/FramePerformanceOverview.js";

const tests = [];

test("meter reports active frame measurements", () => {
    const element = createMeter();
    const overview = new FramePerformanceOverview(
        element,
        "Test",
        createCanvas()
    );

    overview.update(report());
    assert(element.querySelector("[data-performance-output]")
        .textContent.includes("Frame (ms)"));
    assert(element.textContent.includes("Period layout (ms)"));
    assert(element.textContent.includes("Viewport discovery"));
    assert(element.textContent.includes("Column projection"));
    assert(element.textContent.includes("Selected cols"));
    assert(element.textContent.includes("Projected cols"));
});

test("reset samples keeps the active report visible", () => {
    const element = createMeter();
    const overview = new FramePerformanceOverview(
        element,
        "Test",
        createCanvas()
    );

    overview.update(report());
    element.querySelector("[data-reset-worst]").click();
    assert(element.textContent.includes("Frame (ms)"));
    assert(element.textContent.includes("Samples"));
});

test("five-second capture freezes the existing report sample summary", () => {
    const element = createMeter();
    const canvas = createCanvas();
    const overview = new FramePerformanceOverview(element, "Test", canvas);
    const originalSetTimeout = window.setTimeout;
    const originalClearTimeout = window.clearTimeout;
    let finishCapture = null;

    window.setTimeout = (callback, duration) => {
        equal(duration, 5000);
        finishCapture = callback;
        return 1;
    };
    window.clearTimeout = () => {};

    try {
        element.querySelector("[data-capture-performance]").click();
        overview.update(report());
        overview.update({...report(), totalTime: 20, renderingTime: 8});
        finishCapture();

        const captured = element.querySelector("[data-performance-output]")
            .textContent;
        assert(captured.includes("CAPTURE 5s — COMPLETE"));
        assert(captured.includes("Browser / UA"));
        assert(captured.includes("Viewport CSS"));
        assert(captured.includes("Canvas CSS"));
        assert(captured.includes("Canvas backing"));
        assert(captured.includes("MODE"));
        assert(captured.includes("NORMAL"));
        assert(captured.includes("SOURCE"));
        assert(captured.includes(
            "HALF-RES 2500×1250 / LOGICAL 5000×2500"
        ));
        assert(captured.includes("Samples"));
        assert(captured.includes("2"));

        overview.update({...report(), totalTime: 99});
        equal(
            element.querySelector("[data-performance-output]").textContent,
            captured
        );
        element.querySelector("[data-reset-worst]").click();
        assert(!element.textContent.includes("CAPTURE 5s — COMPLETE"));
    } finally {
        window.setTimeout = originalSetTimeout;
        window.clearTimeout = originalClearTimeout;
        canvas.remove();
    }
});

function createMeter() {
    const element = document.createElement("aside");
    element.innerHTML = `
        <div data-performance-body>
            <pre data-performance-output></pre>
            <button type="button" data-capture-performance></button>
            <button type="button" data-reset-worst></button>
        </div>
    `;
    document.body.append(element);
    return element;
}

function createCanvas() {
    const canvas = document.createElement("canvas");
    canvas.width = 1000;
    canvas.height = 500;
    document.body.append(canvas);
    return canvas;
}

function report() {
    return {
        totalTime: 10,
        geometryTime: 1,
        periodGeometryTime: 0.2,
        viewportDiscoveryTime: 0.1,
        columnProjectionTime: 0.7,
        viewportTime: 1,
        canvasResetTime: 1,
        renderingTime: 4,
        overlayTime: 1,
        destinationMode: "viewport",
        pixelRatio: 2,
        canvasWidth: 1000,
        canvasHeight: 500,
        destinationPixelCount: 500000,
        drawImageCalls: 100,
        visibleColumns: 100,
        projectedColumns: 200,
        totalColumns: 1000,
        periodCount: 10,
        drawCallProbeMode: "normal",
        sourceDescription: "HALF-RES 2500×1250 / LOGICAL 5000×2500"
    };
}

function equal(actual, expected) {
    assert(actual === expected, `Expected ${actual} to equal ${expected}`);
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
        : `FAIL ${tests.length - failures.length}/${tests.length}\n${failures.join("\n")}`;
    document.getElementById("results").textContent = summary;
    document.title = summary.split("\n")[0];
    console.log(summary);
}

run();
