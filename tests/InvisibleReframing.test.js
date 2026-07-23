import { SimoneApplication } from "../src/application/SimoneApplication.js";
import {
    horizontalReframeDirection
} from "../src/application/startSimone.js";
import { Viewport } from "../src/viewport/Viewport.js";

const tests = [];

test("right-edge inward exploration requests later content", () => {
    equal(horizontalReframeDirection(0.95, -41, 400), 1);
});

test("left-edge inward exploration requests earlier content", () => {
    equal(horizontalReframeDirection(0.05, 41, 400), -1);
});

test("ordinary and outward drags do not request reframing", () => {
    equal(horizontalReframeDirection(0.5, -100, 400), 0);
    equal(horizontalReframeDirection(0.95, -40, 400), 0);
    equal(horizontalReframeDirection(0.95, 100, 400), 0);
    equal(horizontalReframeDirection(0.05, 40, 400), 0);
    equal(horizontalReframeDirection(0.05, -100, 400), 0);
});

test("reframing settles by half a viewport with smoothstep easing", () => {
    const viewport = createViewport(100);
    const application = createApplication(viewport);
    const animation = captureAnimationFrames();
    let renderedFrames = 0;
    let synchronizedFrames = 0;
    application.render = () => {
        renderedFrames += 1;
    };

    assert(application.reframeHorizontal(1, {}, () => {
        synchronizedFrames += 1;
    }));
    animation.runNext(0);
    closeTo(viewport.projectedOffset, 100);
    animation.runNext(225);
    closeTo(viewport.projectedOffset, 200);
    animation.runNext(450);
    closeTo(viewport.projectedOffset, 300);
    equal(renderedFrames, 3);
    equal(synchronizedFrames, 3);
    animation.restore();
});

test("reframing is shortened at viewport bounds", () => {
    const viewport = createViewport(550);
    const application = createApplication(viewport, 900);
    const animation = captureAnimationFrames();
    application.render = () => {};

    assert(application.reframeHorizontal(1, {}));
    animation.runNext(0);
    animation.runNext(450);
    closeTo(viewport.projectedOffset, 600);
    animation.restore();
});

test("reframing does not start when no content remains", () => {
    const viewport = createViewport(600);
    const application = createApplication(viewport);
    let synchronized = false;

    assert(!application.reframeHorizontal(1, {}, () => {
        synchronized = true;
    }));
    assert(synchronized);
    closeTo(viewport.projectedOffset, 600);
});

test("reframing never moves beyond the grabbed point", () => {
    const viewport = createViewport(100);
    const application = createApplication(viewport, 220);
    const animation = captureAnimationFrames();
    application.render = () => {};

    assert(application.reframeHorizontal(1, {}));
    animation.runNext(0);
    animation.runNext(450);
    closeTo(viewport.projectedOffset, 220);
    animation.restore();
});

test("earlier reframing mirrors the grabbed-point limit", () => {
    const viewport = createViewport(300);
    const application = createApplication(viewport, 640);
    const animation = captureAnimationFrames();
    application.render = () => {};

    assert(application.reframeHorizontal(-1, {}));
    animation.runNext(0);
    animation.runNext(450);
    closeTo(viewport.projectedOffset, 240);
    animation.restore();
});

test("grabbed point at the viewport edge prevents reframing", () => {
    const viewport = createViewport(100);
    const application = createApplication(viewport, 100);

    assert(!application.reframeHorizontal(1, {}));
    closeTo(viewport.projectedOffset, 100);
});

test("viewport position reflects settled offset changes", () => {
    const viewport = createViewport(100);

    closeTo(viewport.position, 1 / 6);
    viewport.shiftProjectedOffset(200);
    closeTo(viewport.position, 0.5);
});

function createViewport(offset) {
    const viewport = new Viewport({
        projectedOffset: offset,
        projectedExtent: 400,
        presentationExtent: 400
    });
    viewport.setProjectedContentRange(0, 1000);
    return viewport;
}

function createApplication(viewport, grabbedProjectedX = 400) {
    const application = new SimoneApplication({
        artworkLoader: null,
        parameters: { carrierDistance: 0 },
        curtainField: {
            resetCurtainState: 0.55,
            projectedXForInteraction: () => grabbedProjectedX,
            resolvedParametersAt: () => ({ projectedCarrierSpacing: 20 })
        },
        viewport,
        phaseResolver: null,
        surfaces: null,
        shading: null,
        renderer: null
    });
    application.artwork = {};
    return application;
}

function captureAnimationFrames() {
    const originalRequest = window.requestAnimationFrame;
    const originalCancel = window.cancelAnimationFrame;
    const frames = [];
    window.requestAnimationFrame = (callback) => {
        frames.push(callback);
        return frames.length;
    };
    window.cancelAnimationFrame = () => {};

    return {
        runNext(timestamp) {
            const frame = frames.shift();
            assert(frame, "Expected a scheduled animation frame");
            frame(timestamp);
        },
        restore() {
            window.requestAnimationFrame = originalRequest;
            window.cancelAnimationFrame = originalCancel;
        }
    };
}

function closeTo(actual, expected) {
    assert(Math.abs(actual - expected) <= 1e-12,
        `Expected ${actual} to equal ${expected}`);
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
