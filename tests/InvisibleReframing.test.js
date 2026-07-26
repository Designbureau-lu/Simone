import { SimoneApplication } from "../src/application/SimoneApplication.js";
import {
    horizontalReframeDirection
} from "../src/application/startSimone.js";
import { Viewport } from "../src/viewport/Viewport.js";
import { CurtainField } from "../src/surface/CurtainField.js";
import { SurfaceParameters } from "../src/surface/SurfaceParameters.js";

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
    const viewport = createViewport(950);
    const application = createApplication(viewport, 1000);
    const animation = captureAnimationFrames();
    application.render = () => {};

    assert(application.reframeHorizontal(1, {}));
    animation.runNext(0);
    animation.runNext(450);
    closeTo(viewport.projectedOffset, 1000);
    animation.restore();
});

test("reframing does not start when no content remains", () => {
    const viewport = createViewport(1000);
    const application = createApplication(viewport);
    let synchronized = false;

    assert(!application.reframeHorizontal(1, {}, () => {
        synchronized = true;
    }));
    assert(synchronized);
    closeTo(viewport.projectedOffset, 1000);
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

test("grabbing the curtain cancels an active viewport sequence", () => {
    const viewport = createViewport(100);
    const application = createApplication(viewport);
    const animation = captureAnimationFrames();
    application.render = () => {};

    assert(application.animateViewportToProjectedOffset(300));
    assert(application.horizontalReframeFrame !== null);
    assert(application.beginLocalInteraction(100));
    equal(application.horizontalReframeFrame, null);
    animation.restore();
});

test("viewport position reflects settled offset changes", () => {
    const viewport = createViewport(100);

    closeTo(viewport.position, 0.1);
    viewport.shiftProjectedOffset(200);
    closeTo(viewport.position, 0.3);
});

test("rightward interaction has no influence before its boundary period", () => {
    const field = new CurtainField({ resetCurtainState: 0.55 });
    field.configureFor(1000, 100);
    const interaction = field.beginRightwardInteractionAtPeriod(3);

    equal(interaction.periodIndex, 3);
    equal(interaction.localPosition, 0);
    equal(interaction.leftInfluence, 0);
    field.applyLocalDisplacement(interaction, 1000, 100, 0.2, 0.9);

    equal(field.periods[0].visibleFactor, 0.55);
    equal(field.periods[1].visibleFactor, 0.55);
    equal(field.periods[2].visibleFactor, 0.55);
    assert(field.periods[3].visibleFactor > 0.55);
    assert(field.periods[4].visibleFactor > 0.55);
});

test("reset animation converges every period exactly to its target", () => {
    const field = new CurtainField({ resetCurtainState: 0.55 });
    field.configureFor(300, 100);
    field.periods[0].setVisibleFactor(0.2);
    field.periods[1].setVisibleFactor(0.55);
    field.periods[2].setVisibleFactor(0.9);
    const application = new SimoneApplication({
        artworkLoader: null,
        parameters: new SurfaceParameters(),
        curtainField: field,
        viewport: createViewport(0),
        phaseResolver: null,
        surfaces: null,
        shading: null,
        renderer: null
    });
    application.artwork = {};
    application.sceneVisibleFactor = 0.2;
    application.render = () => {};
    const animation = captureAnimationFrames();
    let completed = 0;

    assert(application.animateResetCurtainState({
        resetCurtainState: 0.5
    }, null, () => {
        completed += 1;
    }));
    animation.runNext(0);
    equal(field.periods[0].visibleFactor, 0.2);
    equal(field.periods[1].visibleFactor, 0.55);
    equal(field.periods[2].visibleFactor, 0.9);
    animation.runNext(300);
    closeTo(field.periods[0].visibleFactor, 0.4625);
    closeTo(field.periods[1].visibleFactor, 0.50625);
    closeTo(field.periods[2].visibleFactor, 0.55);
    animation.runNext(600);
    equal(field.periods[0].visibleFactor, 0.5);
    equal(field.periods[1].visibleFactor, 0.5);
    equal(field.periods[2].visibleFactor, 0.5);
    equal(field.resetCurtainState, 0.5);
    equal(application.sceneVisibleFactor, 0.5);
    equal(application.resetCurtainFrame, null);
    equal(completed, 1);
    animation.restore();
});

test("starting a new curtain interaction cancels reset animation", () => {
    const viewport = createViewport(0);
    const application = createApplication(viewport);
    const animation = captureAnimationFrames();
    application.curtainField.periods = [];
    application.curtainField.setResetCurtainStateTarget = () => {};
    application.curtainField.setResetCurtainState = () => {};
    application.curtainField.setVisibleFactors = () => {};
    application.curtainField.periods = [{ visibleFactor: 0.4 }];
    application.parameters.configure = () => {};
    application.parameters.resolve = () => ({ visibleFactor: 0.5 });
    application.render = () => {};

    assert(application.animateResetCurtainState({
        resetCurtainState: 0.5
    }));
    assert(application.resetCurtainFrame !== null);
    application.beginLocalInteraction(100);
    equal(application.resetCurtainFrame, null);
    animation.restore();
});

test("project selection resets before using shared indexed navigation", () => {
    const application = createApplication(createViewport(0));
    const sequence = [];
    const synchronized = () => {};
    application.animateResetCurtainState = (
        values,
        onFrame,
        onComplete
    ) => {
        sequence.push([
            "reset",
            values.resetCurtainState,
            onFrame
        ]);
        onComplete();
        return true;
    };
    application.navigateToProject = (index, onFrame, openingMode) => {
        sequence.push(["navigate", index, onFrame, openingMode]);
        return true;
    };

    assert(application.resetAndNavigateToProject(
        4,
        synchronized
    ));
    equal(sequence.length, 2);
    equal(sequence[0][0], "reset");
    equal(sequence[0][1], 0.5);
    equal(sequence[0][2], null);
    equal(sequence[1][0], "navigate");
    equal(sequence[1][1], 4);
    equal(sequence[1][2], synchronized);
    equal(sequence[1][3], "flat-semantic-span");
});

test("selected project opens as one uniform semantic period span", () => {
    const viewport = createViewport(0);
    const application = createApplication(viewport);
    const animation = captureAnimationFrames();
    const field = new CurtainField({ resetCurtainState: 0.5 });
    field.configureFor(1000, 100);
    application.curtainField = field;
    application.render = () => {};
    application.artwork.width = 1000;
    application.artwork.sourceXForLogicalX = (logicalX) => logicalX;
    application.logicalArtworkWidth = 1000;
    application.logicalImageWidth = 1000;
    application.projectedContentBounds = { start: 0, end: 900 };
    application.projectedColumns = Array.from(
        { length: 1000 },
        (_, sourceX) => ({
            placement: {
                targetX: sourceX,
                periodIndex: Math.floor(sourceX / 100)
            }
        })
    );
    application.parameters.maximumVisibleFactor = 0.9;
    application.setProjectNavigation({
        enabled: true,
        projects: [
            { title: "First", artworkStart: 0, artworkEnd: 300 },
            { title: "Second", artworkStart: 320, artworkEnd: 680 }
        ]
    });

    assert(application.navigateToProject(
        1,
        null,
        "flat-semantic-span"
    ));
    animation.runNext(0);
    animation.runNext(450);
    equal(viewport.projectedOffset, 300);
    animation.runNext(450);
    animation.runNext(950);

    for (let index = 3; index <= 6; index += 1) {
        equal(field.periods[index].visibleFactor, 0.7);
    }

    animation.runNext(1450);

    for (let index = 0; index < field.periods.length; index += 1) {
        equal(
            field.periods[index].visibleFactor,
            index >= 3 && index <= 6 ? 0.9 : 0.5
        );
    }
    animation.restore();
});

test("semantic project navigation moves both ways without wrapping", () => {
    const viewport = createViewport(100);
    const application = createApplication(viewport);
    const animation = captureAnimationFrames();
    application.render = () => {};
    application.projectedColumns = [];
    application.artwork.width = 1000;
    application.artwork.sourceXForLogicalX = (logicalX) => logicalX;
    application.logicalArtworkWidth = 1000;
    application.logicalImageWidth = 1000;
    application.projectedContentBounds = { start: 0, end: 900 };
    application.projectedColumns[0] = {
        placement: { targetX: 0, periodIndex: 0 }
    };
    application.projectedColumns[20] = {
        placement: { targetX: 20 }
    };
    application.projectedColumns[50] = {
        placement: { targetX: 50 }
    };
    application.projectedColumns[300] = {
        placement: { targetX: 350, periodIndex: 3 }
    };
    application.projectedColumns[320] = {
        placement: { targetX: 370 }
    };
    application.projectedColumns[350] = {
        placement: { targetX: 400 }
    };
    application.projectedColumns[700] = {
        placement: { targetX: 800, periodIndex: 7 }
    };
    application.projectedColumns[720] = {
        placement: { targetX: 820 }
    };
    application.projectedColumns[750] = {
        placement: { targetX: 850 }
    };
    const autoOpenDisplacements = [];
    application.parameters.carrierDistance = 100;
    application.parameters.minimumVisibleFactor = 0.2;
    application.parameters.maximumVisibleFactor = 0.9;
    let autoOpenInteractions = 0;
    const autoOpenLocations = [];
    application.curtainField.beginRightwardInteractionAtPeriod = (
        periodIndex
    ) => {
        autoOpenInteractions += 1;
        autoOpenLocations.push(periodIndex);
        return {
            periodIndex,
            localPosition: 0,
            leftInfluence: 0,
            rightwardOnly: true
        };
    };
    application.curtainField.applyLocalDisplacement = (
        interaction,
        displacement
    ) => {
        autoOpenDisplacements.push(displacement);
        return 0.6;
    };
    application.setProjectNavigation({
        enabled: true,
        totalUnits: 10,
        layout: { unitWidth: 100, gutterWidth: 40 },
        projects: [
            { title: "First", artworkStart: 0, artworkEnd: 300 },
            { title: "Second", artworkStart: 300, artworkEnd: 700 },
            { title: "Third", artworkStart: 700, artworkEnd: 1000 }
        ]
    });

    assert(application.navigateToNextProject());
    equal(application.currentProjectIndex, 1);
    equal(autoOpenInteractions, 0);
    animation.runNext(0);
    equal(autoOpenDisplacements.length, 0);
    animation.runNext(315);
    equal(autoOpenDisplacements.length, 0);
    animation.runNext(337.5);
    equal(autoOpenDisplacements.length, 0);
    animation.runNext(360);
    equal(autoOpenDisplacements.length, 0);
    animation.runNext(382.5);
    equal(autoOpenDisplacements.length, 0);
    animation.runNext(405);
    equal(autoOpenDisplacements.length, 0);
    animation.runNext(427.5);
    equal(autoOpenDisplacements.length, 0);
    animation.runNext(450);
    closeTo(viewport.projectedOffset, 350);
    equal(autoOpenInteractions, 1);
    equal(autoOpenLocations[0], 3);
    equal(autoOpenDisplacements.length, 0);
    animation.runNext(450);
    equal(autoOpenDisplacements.length, 1);
    closeTo(autoOpenDisplacements[0], 0);
    animation.runNext(512.5);
    closeTo(autoOpenDisplacements[1], 200);
    animation.runNext(575);
    closeTo(autoOpenDisplacements[2], 400);

    assert(application.navigateToNextProject());
    equal(application.currentProjectIndex, 2);
    animation.runNext(0);
    animation.runNext(450);
    closeTo(viewport.projectedOffset, 800);
    animation.runNext(450);
    animation.runNext(575);
    closeTo(autoOpenDisplacements.at(-1), 300);
    assert(!application.navigateToNextProject());
    equal(application.currentProjectIndex, 2);

    assert(application.navigateToPreviousProject());
    equal(application.currentProjectIndex, 1);
    animation.runNext(0);
    animation.runNext(450);
    closeTo(viewport.projectedOffset, 350);
    animation.runNext(450);
    animation.runNext(575);
    closeTo(autoOpenDisplacements.at(-1), 400);

    assert(application.navigateToPreviousProject());
    equal(application.currentProjectIndex, 0);
    animation.runNext(0);
    animation.runNext(450);
    closeTo(viewport.projectedOffset, 0);
    animation.runNext(450);
    animation.runNext(575);
    closeTo(autoOpenDisplacements.at(-1), 300);
    assert(!application.navigateToPreviousProject());
    equal(application.currentProjectIndex, 0);
    animation.restore();
});

test("later project spans cannot change an earlier projected boundary", () => {
    const application = createApplication(createViewport(100));
    const project = { title: "Bubles", artworkStart: 1320 };
    application.artwork.width = 5000;
    application.artwork.sourceXForLogicalX = (logicalX) => Math.floor(
        logicalX * 5000 / 4400
    );
    application.logicalArtworkWidth = 4400;
    application.logicalImageWidth = 4400;
    application.projectedColumns = [];
    application.projectedColumns[1500] = {
        placement: { targetX: 1335.92 }
    };
    application.projectedContentBounds = { start: 0, end: 4500 };
    application.projectNavigation = {
        totalUnits: 10,
        projectSpanUnits: 6,
        layout: { unitWidth: 440 }
    };
    const before = application.projectProjectionFor(project);

    application.projectNavigation = {
        ...application.projectNavigation,
        projectSpanUnits: 10
    };
    const after = application.projectProjectionFor(project);

    equal(before.projectArtworkStart, 1320);
    equal(before.sourceX, 1500);
    closeTo(before.requestedNextTarget, after.requestedNextTarget);
});

test("viewport preserves the left bound and permits trailing white space", () => {
    const viewport = createViewport(100);

    viewport.shiftProjectedOffset(10_000);
    closeTo(viewport.projectedOffset, 1000);
    viewport.shiftProjectedOffset(-10_000);
    closeTo(viewport.projectedOffset, 0);
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
            beginLocalInteraction: () => ({}),
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
