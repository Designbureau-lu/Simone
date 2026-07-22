import {
    bindPerformanceOverviewCollapse
} from "../src/application/startSimone.js";
import {
    ModelCPerformanceOverview
} from "../src/prototypes/model-c/ModelCPerformanceOverview.js";

const SESSION_KEY = "simone.performanceOverview.expanded";
const tests = [];

test("meter defaults to collapsed", () => {
    sessionStorage.removeItem(SESSION_KEY);
    const element = createMeter();
    bindPerformanceOverviewCollapse(element);

    assert(element.querySelector("[data-performance-body]").hidden);
    equal(element.querySelector("[data-performance-toggle]").textContent, "▸");
});

test("meter continues updating while collapsed", () => {
    sessionStorage.removeItem(SESSION_KEY);
    const element = createMeter();
    bindPerformanceOverviewCollapse(element);
    const overview = new ModelCPerformanceOverview(element, "Test");

    overview.update(report());
    assert(element.querySelector("[data-performance-body]").hidden);
    assert(element.querySelector("[data-performance-output]")
        .textContent.includes("Frame (ms)"));
});

test("toggle expands and restores current output", () => {
    sessionStorage.removeItem(SESSION_KEY);
    const element = createMeter();
    bindPerformanceOverviewCollapse(element);
    const overview = new ModelCPerformanceOverview(element, "Test");
    overview.update(report());

    element.querySelector("[data-performance-toggle]").click();
    assert(!element.querySelector("[data-performance-body]").hidden);
    equal(element.querySelector("[data-performance-toggle]").textContent, "▾");
    assert(element.textContent.includes("Selected cols"));
});

test("expanded state persists for the browser session", () => {
    sessionStorage.setItem(SESSION_KEY, "expanded");
    const element = createMeter();
    bindPerformanceOverviewCollapse(element);

    assert(!element.querySelector("[data-performance-body]").hidden);
    equal(element.querySelector("[data-performance-toggle]").textContent, "▾");
});

function createMeter() {
    const element = document.createElement("aside");
    element.innerHTML = `
        <div><span>Performance Meter</span><button type="button" data-performance-toggle>▸</button></div>
        <div data-performance-body><pre data-performance-output></pre><button type="button" data-reset-worst></button></div>
    `;
    document.body.append(element);
    return element;
}

function report() {
    return {
        totalTime: 10,
        geometryTime: 1,
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
        totalColumns: 1000,
        periodCount: 10
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
