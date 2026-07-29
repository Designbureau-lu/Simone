import { ViewingSurface } from "../src/viewport/ViewingSurface.js";

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
