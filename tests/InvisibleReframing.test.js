import { SimoneApplication } from "../src/application/SimoneApplication.js";
import {
    bindCurtainDragging,
    horizontalReframeDirection,
    isCurtainClick,
    lowPass,
    touchGestureIntent
} from "../src/application/startSimone.js";
import { Viewport } from "../src/viewport/Viewport.js";
import { CurtainField } from "../src/surface/CurtainField.js";
import { SurfaceParameters } from "../src/surface/SurfaceParameters.js";
import { SurfaceShading } from "../src/shading/SurfaceShading.js";

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

test("Moses click tolerance preserves drag as the dominant gesture", () => {
    assert(isCurtainClick(0, 0));
    assert(isCurtainClick(3, 4));
    assert(!isCurtainClick(4, 4));
    assert(!isCurtainClick(6, 0));
});

test("curtain click keeps local reveal without selecting an Index project", () => {
    const canvas = createTouchCanvas();
    const project = { title: "Airbag" };
    let revealCalls = 0;
    let projectCalls = 0;
    let hintCalls = 0;
    const application = {
        viewport: { projectedExtent: 400 },
        beginLocalInteraction: () => ({ periodIndex: 1 }),
        desktopCurtainNeighborReach: () => 40,
        interactionDisplacementScale: () => 1,
        desktopCurtainDirectDragScale: () => 0.5,
        projectAtPresentationX: () => project,
        revealLocalInteraction: () => {
            revealCalls += 1;
            return true;
        }
    };
    const conversation = {
        showProject: () => {
            projectCalls += 1;
        },
        showDragHint: () => {
            hintCalls += 1;
        },
        clearProjectSelection() {},
        markDragLearned() {},
        markExplorationInactive() {}
    };
    bindCurtainDragging(canvas, application, () => {}, conversation);

    canvas.dispatchEvent(pointerEvent("pointerdown", 1, 100, 100, 0));
    canvas.dispatchEvent(pointerEvent("pointerup", 1, 100, 100, 16));

    equal(revealCalls, 1);
    equal(projectCalls, 0);
    equal(hintCalls, 1);
});

test("touch intent uses asymmetric dominance beyond a 12px dead zone", () => {
    equal(touchGestureIntent(12, 0), "pending");
    equal(touchGestureIntent(0, 12), "pending");
    equal(touchGestureIntent(13, 0), "horizontal");
    equal(touchGestureIntent(0, 13), "vertical");
    equal(touchGestureIntent(14, 13), "horizontal");
    equal(touchGestureIntent(13, 14), "pending");
    equal(touchGestureIntent(8, 14), "vertical");
    equal(touchGestureIntent(9, 14), "pending");
});

test("touch response smoothing follows without overshoot", () => {
    const first = lowPass(0, 1, 45, 45);
    const second = lowPass(first, 1, 45, 45);

    assert(first > 0);
    assert(first < 1);
    assert(second > first);
    assert(second < 1);
});

test("pinch moves two curtain grabs outward from its center", () => {
    const field = new CurtainField({ resetCurtainState: 0.5 });
    const application = new SimoneApplication({
        artworkLoader: null,
        parameters: new SurfaceParameters(),
        curtainField: field,
        viewport: createViewport(300),
        phaseResolver: null,
        surfaces: null,
        shading: null,
        renderer: null
    });
    application.artwork = {};
    application.render = () => {};
    field.configureFor(10000, 100);
    field.resolve(application.parameters);
    const viewportOffset = application.viewport.projectedOffset;
    const pinch = application.beginTouchPinch(570);
    const center = pinch.periodIndex;
    const baseFactors = [...pinch.visibleFactors];
    closeTo(pinch.localPosition, 0.5);
    const fixedCenter = pinch.pinchCenterProjectedX;

    application.updateTouchPinch(pinch, 120);
    assert(
        field.periods[center].visibleFactor > 0.5,
        `Expected center to open, got ${field.periods[center].visibleFactor}`
    );
    assert(
        field.periods[center - 10].visibleFactor < 0.5,
        `Expected left outside to gather, got ${field.periods[center - 10].visibleFactor}`
    );
    assert(
        field.periods[center + 10].visibleFactor < 0.5,
        `Expected right outside to gather, got ${field.periods[center + 10].visibleFactor}`
    );
    closeTo(pinch.pinchCenterProjectedX, fixedCenter);
    const strongInsideOpening = field.periods[center].visibleFactor;
    closeTo(application.viewport.projectedOffset, viewportOffset);

    application.updateTouchPinch(pinch, 40);
    assert(
        field.periods[center].visibleFactor < strongInsideOpening
    );

    application.updateTouchPinch(pinch, 0);
    field.periods.forEach((period, index) => {
        closeTo(period.visibleFactor, baseFactors[index]);
    });
    closeTo(application.viewport.projectedOffset, viewportOffset);

    application.updateTouchPinch(pinch, 10000);
    field.periods.forEach((period) => {
        assert(period.visibleFactor >= 0.2);
        assert(period.visibleFactor <= 1);
    });
});

test("pinch center and redistribution remain stable for unchanged input", () => {
    const field = new CurtainField({ resetCurtainState: 0.5 });
    const application = new SimoneApplication({
        artworkLoader: null,
        parameters: new SurfaceParameters(),
        curtainField: field,
        viewport: createViewport(300),
        phaseResolver: null,
        surfaces: null,
        shading: null,
        renderer: null
    });
    application.artwork = {};
    application.render = () => {};
    field.configureFor(10000, 100);
    field.resolve(application.parameters);
    const pinch = application.beginTouchPinch(570);
    const fixedCenter = pinch.pinchCenterProjectedX;

    application.updateTouchPinch(pinch, 120);
    const firstFactors = field.periods.map((period) => period.visibleFactor);
    application.updateTouchPinch(pinch, 120);
    const secondFactors = field.periods.map((period) => period.visibleFactor);

    closeTo(pinch.pinchCenterProjectedX, fixedCenter);
    closeTo(maximumFactorDifference(firstFactors, secondFactors), 0);
});

test("pinch deformation crosses Period boundaries continuously", () => {
    const field = new CurtainField({ resetCurtainState: 0.5 });
    const application = new SimoneApplication({
        artworkLoader: null,
        parameters: new SurfaceParameters(),
        curtainField: field,
        viewport: createViewport(300),
        phaseResolver: null,
        surfaces: null,
        shading: null,
        renderer: null
    });
    application.artwork = {};
    application.render = () => {};
    field.configureFor(10000, 100);
    field.resolve(application.parameters);
    const pinch = application.beginTouchPinch(570);
    const rightEdge = pinch.pinchProjectedPeriodWidths
        .slice(0, pinch.periodIndex + 1)
        .reduce((total, width) => total + width, 0);
    const boundaryDisplacement = rightEdge
        - pinch.pinchCenterProjectedX;
    const epsilon = 0.000001;

    application.updateTouchPinch(pinch, boundaryDisplacement - epsilon);
    const before = field.periods.map((period) => period.visibleFactor);
    application.updateTouchPinch(pinch, boundaryDisplacement + epsilon);
    const after = field.periods.map((period) => period.visibleFactor);

    assert(maximumFactorDifference(before, after) < 0.000001);
});

test("touch input transitions directly between pan and pinch", () => {
    const canvas = createTouchCanvas();
    const calls = [];
    const application = {
        viewport: { projectedExtent: 400 },
        beginTouchExploration(targetX) {
            calls.push(["begin-pan", targetX]);
            return { visibleFactors: [0.5] };
        },
        beginTouchPinch(midpointTargetX) {
            calls.push(["begin-pinch", midpointTargetX]);
            return { visibleFactors: [0.5] };
        },
        updateTouchPinch(interaction, displacement) {
            calls.push(["pinch", displacement]);
            return true;
        },
        interactionDisplacementScale: () => 1,
        projectAtPresentationX: () => null,
        updateTouchExploration() {
            calls.push(["pan"]);
            return true;
        },
        settleTouchExploration(...arguments_) {
            calls.push(["settle"]);
            arguments_.at(-1)?.();
            return true;
        },
        revealLocalInteraction: () => false
    };
    const conversation = {
        clearProjectSelection() {},
        markDragLearned() {},
        showDragHint() {},
        markExplorationInactive() {
            calls.push(["inactive"]);
        }
    };
    bindCurtainDragging(canvas, application, () => {}, conversation);

    canvas.dispatchEvent(touchEvent("pointerdown", 1, 100, 100, 0));
    canvas.dispatchEvent(touchEvent("pointermove", 1, 120, 100, 16));
    canvas.dispatchEvent(touchEvent("pointerdown", 2, 200, 100, 20));
    const pinchStart = calls.find(([name]) => name === "begin-pinch");
    closeTo(pinchStart[1], 160);
    const panCallsBeforePinch = calls.filter(
        ([name]) => name === "pan"
    ).length;
    canvas.dispatchEvent(touchEvent("pointermove", 2, 260, 100, 36));
    equal(
        calls.filter(([name]) => name === "pan").length,
        panCallsBeforePinch
    );
    const pinchUpdate = calls.find(([name]) => name === "pinch");
    assert(pinchUpdate);
    closeTo(pinchUpdate[1], 45);

    canvas.dispatchEvent(touchEvent("pointerup", 2, 260, 100, 40));
    canvas.dispatchEvent(touchEvent("pointermove", 1, 140, 100, 56));
    assert(
        calls.filter(([name]) => name === "begin-pan").length === 2
    );
    assert(
        calls.filter(([name]) => name === "pan").length
            > panCallsBeforePinch
    );
    canvas.dispatchEvent(touchEvent("pointerup", 1, 140, 100, 60));
    assert(calls.some(([name]) => name === "inactive"));

    canvas.dispatchEvent(touchEvent("pointerdown", 3, 160, 60, 70));
    canvas.dispatchEvent(touchEvent("pointerdown", 4, 160, 140, 74));
    const verticalPinchStart = calls.filter(
        ([name]) => name === "begin-pinch"
    ).at(-1);
    closeTo(verticalPinchStart[1], 160);
    canvas.dispatchEvent(touchEvent("pointermove", 4, 160, 200, 90));
    const verticalPinchUpdate = calls.filter(
        ([name]) => name === "pinch"
    ).at(-1);
    closeTo(verticalPinchUpdate[1], pinchUpdate[1]);
    canvas.dispatchEvent(touchEvent("pointerup", 4, 160, 200, 94));
    canvas.dispatchEvent(touchEvent("pointerup", 3, 160, 60, 98));

    canvas.dispatchEvent(touchEvent("pointerdown", 5, 150, 100, 110));
    canvas.dispatchEvent(touchEvent("pointerdown", 6, 170, 100, 114));
    const nearTouchPinchStart = calls.filter(
        ([name]) => name === "begin-pinch"
    ).at(-1);
    closeTo(nearTouchPinchStart[1], pinchStart[1]);
    canvas.dispatchEvent(touchEvent("pointermove", 6, 230, 100, 130));
    const nearTouchPinchUpdate = calls.filter(
        ([name]) => name === "pinch"
    ).at(-1);
    closeTo(nearTouchPinchUpdate[1], pinchUpdate[1]);
    canvas.dispatchEvent(touchEvent("pointerup", 6, 230, 100, 134));
    canvas.dispatchEvent(touchEvent("pointerup", 5, 150, 100, 138));
});

test("vertical touch intent remains native and never starts curtain exploration", () => {
    const canvas = createTouchCanvas();
    const calls = [];
    const application = {
        viewport: { projectedExtent: 400 },
        beginTouchExploration() {
            calls.push("begin");
            return { visibleFactors: [0.5] };
        },
        interactionDisplacementScale: () => 1,
        projectAtPresentationX: () => null,
        updateTouchExploration() {
            calls.push("update");
        },
        settleTouchExploration() {
            calls.push("settle");
        }
    };
    const conversation = {
        clearProjectSelection() {},
        markDragLearned() {},
        showDragHint() {},
        markExplorationInactive() {}
    };
    bindCurtainDragging(canvas, application, () => {}, conversation);

    const down = touchEvent("pointerdown", 11, 180, 100, 0);
    const move = touchEvent("pointermove", 11, 182, 116, 16);
    canvas.dispatchEvent(down);
    canvas.dispatchEvent(move);
    canvas.dispatchEvent(touchEvent("pointercancel", 11, 182, 116, 20));

    equal(down.defaultPrevented, false);
    equal(move.defaultPrevented, false);
    equal(calls.length, 0);
    equal(canvas.hasPointerCapture(11), false);
});

test("temporary touch reveal is symmetric and restores its base state", () => {
    const field = new CurtainField({ resetCurtainState: 0.5 });
    const parameters = new SurfaceParameters();
    field.configureFor(1000, 100);
    field.resolve(parameters);
    const interaction = field.beginLocalInteraction(350);

    field.applyTemporaryReveal(interaction, 0.04, 0, 0.2, 1);
    closeTo(
        field.periods[interaction.periodIndex].visibleFactor,
        0.54
    );
    closeTo(
        field.periods[interaction.periodIndex - 1].visibleFactor,
        field.periods[interaction.periodIndex + 1].visibleFactor
    );
    assert(
        field.periods[interaction.periodIndex - 1].visibleFactor > 0.5
    );

    field.applyTemporaryReveal(interaction, 0, 0, 0.2, 1);
    field.periods.forEach((period) => {
        equal(period.visibleFactor, 0.5);
    });
});

test("left and right touch velocities create mirrored directional bias", () => {
    const field = new CurtainField({ resetCurtainState: 0.5 });
    const parameters = new SurfaceParameters();
    field.configureFor(2000, 100);
    field.resolve(parameters);
    const interaction = field.beginLocalInteraction(800);
    const leftIndex = interaction.periodIndex - 1;
    const rightIndex = interaction.periodIndex + 1;

    field.applyTemporaryReveal(interaction, 0.1, -0.04, 0.2, 1);
    const leftDrag = {
        left: field.periods[leftIndex].visibleFactor,
        center: field.periods[interaction.periodIndex].visibleFactor,
        right: field.periods[rightIndex].visibleFactor
    };
    assert(leftDrag.left < leftDrag.right);
    closeTo(leftDrag.center, 0.6);

    field.applyTemporaryReveal(interaction, 0.1, 0.04, 0.2, 1);
    const rightDrag = {
        left: field.periods[leftIndex].visibleFactor,
        center: field.periods[interaction.periodIndex].visibleFactor,
        right: field.periods[rightIndex].visibleFactor
    };
    assert(rightDrag.left > rightDrag.right);
    closeTo(rightDrag.center, 0.6);
    closeTo(leftDrag.left, rightDrag.right);
    closeTo(leftDrag.right, rightDrag.left);
});

test("desktop local displacement retains its existing redistribution", () => {
    const field = new CurtainField({ resetCurtainState: 0.5 });
    const parameters = new SurfaceParameters();
    field.configureFor(2000, 100);
    field.resolve(parameters);
    const interaction = field.beginLocalInteraction(800);

    field.applyLocalDisplacement(
        interaction,
        100,
        100,
        0.2,
        1
    );

    assert(
        field.periods[interaction.periodIndex - 1].visibleFactor > 0.5
    );
    assert(
        field.periods[interaction.periodIndex + 1].visibleFactor < 0.5
    );
});

test("grabbed Period opens symmetrically while neighbors remain directional", () => {
    const resultFor = (displacement) => {
        const field = new CurtainField({ resetCurtainState: 0.5 });
        const parameters = new SurfaceParameters();
        field.configureFor(201 * 100, 100);
        field.resolve(parameters);
        const periodWidth = parameters.resolve(0.5).projectedCarrierSpacing;
        const interaction = field.beginLocalInteraction(
            100.5 * periodWidth,
            40
        );
        field.applyLocalDisplacement(
            interaction,
            displacement,
            100,
            0.2,
            1
        );
        return {
            center: field.periods[interaction.periodIndex].visibleFactor,
            left: field.periods[interaction.periodIndex - 1].visibleFactor,
            right: field.periods[interaction.periodIndex + 1].visibleFactor
        };
    };
    const positive = resultFor(100);
    const negative = resultFor(-100);
    const zero = resultFor(0);

    closeTo(positive.center, 0.58);
    closeTo(negative.center, positive.center);
    closeTo(zero.center, 0.5);
    assert(positive.left > 0.5);
    assert(positive.right < 0.5);
    assert(negative.left < 0.5);
    assert(negative.right > 0.5);
    closeTo(positive.left - 0.5, 0.5 - negative.left);
    closeTo(0.5 - positive.right, negative.right - 0.5);
});

test("touch settlement retains only its directional deformation", () => {
    const field = new CurtainField({ resetCurtainState: 0.5 });
    field.configureFor(1000, 100);
    const viewport = createViewport(300);
    const application = new SimoneApplication({
        artworkLoader: null,
        parameters: new SurfaceParameters(),
        curtainField: field,
        viewport,
        phaseResolver: null,
        surfaces: null,
        shading: null,
        renderer: null
    });
    application.artwork = {};
    application.render = () => {};
    field.resolve(application.parameters);
    const interaction = application.beginTouchExploration(200);
    const animation = captureAnimationFrames();

    assert(application.updateTouchExploration(
        interaction,
        40,
        0.04,
        -0.02
    ));
    assert(viewport.projectedOffset < 300);
    closeTo(field.periods[interaction.periodIndex].visibleFactor, 0.54);
    assert(application.settleTouchExploration(
        interaction,
        0.04,
        -0.02,
        1,
        3,
        0,
        1,
        4,
        360
    ));
    animation.runNext(0);
    animation.runNext(180);
    assert(field.periods[interaction.periodIndex].visibleFactor > 0.5);
    animation.runNext(360);
    equal(field.periods[interaction.periodIndex].visibleFactor, 0.5);
    assert(
        field.periods[interaction.periodIndex - 1].visibleFactor < 0.5
    );
    assert(
        field.periods[interaction.periodIndex + 1].visibleFactor > 0.5
    );
    equal(application.touchExplorationFrame, null);
    equal(application.touchExplorationState, null);
    const firstSettledFactors = field.periods.map(
        (period) => period.visibleFactor
    );

    const oppositeInteraction = application.beginTouchExploration(240);
    assert(application.updateTouchExploration(
        oppositeInteraction,
        0,
        0.04,
        0.02
    ));
    assert(application.settleTouchExploration(
        oppositeInteraction,
        0.04,
        0.02,
        1,
        3,
        0,
        1,
        4,
        360
    ));
    animation.runNext(400);
    animation.runNext(760);
    field.periods.forEach((period, index) => {
        assert(
            Math.abs(period.visibleFactor - 0.5)
                < Math.abs(firstSettledFactors[index] - 0.5)
                || period.visibleFactor === 0.5
        );
    });
    animation.restore();
});

test("directional resistance accumulates asymptotically and reverses", () => {
    const field = new CurtainField({ resetCurtainState: 0.5 });
    field.configureFor(1000, 100);
    const application = new SimoneApplication({
        artworkLoader: null,
        parameters: new SurfaceParameters(),
        curtainField: field,
        viewport: createViewport(300),
        phaseResolver: null,
        surfaces: null,
        shading: null,
        renderer: null
    });
    application.artwork = {};
    application.render = () => {};
    field.resolve(application.parameters);
    const animation = captureAnimationFrames();
    const firstInteraction = application.beginTouchExploration(200);
    const leftIndex = firstInteraction.periodIndex - 1;
    const rightIndex = firstInteraction.periodIndex + 1;

    assert(application.updateTouchExploration(
        firstInteraction,
        0,
        0.3,
        -0.3
    ));
    assert(application.settleTouchExploration(
        firstInteraction,
        0.3,
        -0.3,
        1,
        3,
        0,
        1,
        4,
        360
    ));
    animation.runNext(0);
    animation.runNext(360);
    equal(field.periods[firstInteraction.periodIndex].visibleFactor, 0.5);
    const firstRight = field.periods[rightIndex].visibleFactor;
    const firstLeft = field.periods[leftIndex].visibleFactor;
    assert(firstRight > 0.83);
    assert(firstRight < 0.84);
    assert(firstLeft > 0.29);
    assert(firstLeft < 0.31);

    const repeatedInteraction = application.beginTouchExploration(200);
    assert(application.updateTouchExploration(
        repeatedInteraction,
        0,
        0.3,
        -0.3
    ));
    assert(application.settleTouchExploration(
        repeatedInteraction,
        0.3,
        -0.3,
        1,
        3,
        0,
        1,
        4,
        360
    ));
    animation.runNext(400);
    animation.runNext(760);
    const secondRight = field.periods[rightIndex].visibleFactor;
    const secondLeft = field.periods[leftIndex].visibleFactor;
    assert(secondRight > firstRight);
    assert(secondLeft < firstLeft);
    assert(secondRight < 1);
    assert(secondLeft > 0.2);
    assert(secondRight - firstRight < firstRight - 0.5);
    assert(firstLeft - secondLeft < 0.5 - firstLeft);

    const thirdInteraction = application.beginTouchExploration(200);
    assert(application.updateTouchExploration(
        thirdInteraction,
        0,
        0.3,
        -0.3
    ));
    assert(application.settleTouchExploration(
        thirdInteraction,
        0.3,
        -0.3,
        1,
        3,
        0,
        1,
        4,
        360
    ));
    animation.runNext(800);
    animation.runNext(1160);
    const thirdRight = field.periods[rightIndex].visibleFactor;
    const thirdLeft = field.periods[leftIndex].visibleFactor;
    assert(thirdRight > secondRight);
    assert(thirdLeft < secondLeft);
    assert(thirdRight < 1);
    assert(thirdLeft > 0.2);
    assert(thirdRight - secondRight < secondRight - firstRight);
    assert(secondLeft - thirdLeft < firstLeft - secondLeft);
    field.periods.forEach((period) => {
        assert(period.visibleFactor >= 0.2);
        assert(period.visibleFactor <= 1);
    });

    const oppositeInteraction = application.beginTouchExploration(200);
    assert(application.updateTouchExploration(
        oppositeInteraction,
        0,
        0.3,
        0.3
    ));
    assert(application.settleTouchExploration(
        oppositeInteraction,
        0.3,
        0.3,
        1,
        3,
        0,
        1,
        4,
        360
    ));
    animation.runNext(1200);
    animation.runNext(1560);
    assert(field.periods[rightIndex].visibleFactor < thirdRight);
    assert(field.periods[leftIndex].visibleFactor > thirdLeft);
    animation.restore();
});

test("viewport inertia develops the curtain before a continuous stop", () => {
    const runInertia = (
        gestureVelocity,
        initialViewportVelocity = gestureVelocity,
        inertiaGain = 1.75
    ) => {
        const field = new CurtainField({ resetCurtainState: 0.5 });
        field.configureFor(5000, 100);
        const viewport = createViewport(1000, 5000);
        const application = new SimoneApplication({
            artworkLoader: null,
            parameters: new SurfaceParameters(),
            curtainField: field,
            viewport,
            phaseResolver: null,
            surfaces: null,
            shading: null,
            renderer: null
        });
        application.artwork = {};
        application.render = () => {};
        field.resolve(application.parameters);
        const interaction = application.beginTouchExploration(200);
        const animation = captureAnimationFrames();
        const temporaryReveal = Math.min(
            Math.abs(gestureVelocity) * 0.04,
            0.3
        );
        const temporaryDirectionalBias = Math.min(
            Math.max(gestureVelocity * 0.1, -0.3),
            0.3
        );

        assert(application.updateTouchExploration(
            interaction,
            0,
            temporaryReveal,
            temporaryDirectionalBias
        ));
        const openingAtRelease = field.periods[
            interaction.periodIndex
        ].visibleFactor;
        const startingOffset = viewport.projectedOffset;
        assert(application.settleTouchExploration(
            interaction,
            temporaryReveal,
            temporaryDirectionalBias,
            1,
            3,
            initialViewportVelocity,
            inertiaGain,
            4,
            360,
            160,
            0.6
        ));

        let timestamp = 0;
        let frameCount = 0;
        let inertiaFrames = 0;
        let directionMaintained = true;
        let factorsBeforeCameraRest = null;
        let factorsAtCameraRest = null;
        let retainedFactorsAtCameraRest = null;
        let openingAtCameraRest = null;
        while (application.touchExplorationFrame !== null
            && timestamp < 3000) {
            const velocityBeforeFrame = application
                .touchExplorationState.viewportVelocity;
            const inertiaActive = Math.abs(velocityBeforeFrame) > 0.05;
            const factorsBeforeFrame = field.periods.map(
                (period) => period.visibleFactor
            );
            animation.runNext(timestamp);
            if (inertiaActive) {
                inertiaFrames += 1;
                directionMaintained = directionMaintained
                    && field.periods[
                        interaction.periodIndex + 1
                    ].visibleFactor > field.periods[
                        interaction.periodIndex - 1
                    ].visibleFactor;
            }
            if (velocityBeforeFrame !== 0
                && application.touchExplorationState
                && application.touchExplorationState.viewportVelocity === 0) {
                factorsBeforeCameraRest = factorsBeforeFrame;
                factorsAtCameraRest = field.periods.map(
                    (period) => period.visibleFactor
                );
                openingAtCameraRest = field.periods[
                    interaction.periodIndex
                ].visibleFactor;
                retainedFactorsAtCameraRest = [
                    ...application.touchExplorationState.retainedVisibleFactors
                ];
            }
            timestamp += 32;
            frameCount += 1;
        }

        equal(application.touchExplorationFrame, null);
        equal(application.touchExplorationState, null);
        const finalOpening = field.periods[
            interaction.periodIndex
        ].visibleFactor;
        field.periods.forEach((period) => {
            assert(period.visibleFactor >= 0.2);
            assert(period.visibleFactor <= 1);
        });
        const result = {
            left: field.periods[interaction.periodIndex - 1].visibleFactor,
            right: field.periods[interaction.periodIndex + 1].visibleFactor,
            distance: viewport.projectedOffset - startingOffset,
            inertiaFrames,
            directionMaintained,
            frameCount,
            openingAtRelease,
            openingAtCameraRest,
            finalOpening,
            stopDiscontinuity: factorsAtCameraRest
                ? maximumFactorDifference(
                    factorsBeforeCameraRest,
                    factorsAtCameraRest
                )
                : 0,
            retainedDistanceAtCameraRest: factorsAtCameraRest
                ? maximumFactorDifference(
                    factorsAtCameraRest,
                    retainedFactorsAtCameraRest
                )
                : 0
        };
        animation.restore();
        return result;
    };

    const gentle = runInertia(-0.04);
    const gentleWithoutInertia = runInertia(-0.04, 0);
    const fastWithoutInertia = runInertia(-7.5, 0);
    const previousGain = runInertia(-7.5, -3, 1.25);
    const fast = runInertia(-7.5, -3);

    assert(
        fast.distance > gentle.distance + 300,
        `Expected fast travel ${fast.distance} to exceed gentle `
            + `${gentle.distance} by 300`
    );
    assert(fast.inertiaFrames > 0);
    assert(fast.directionMaintained);
    equal(fast.stopDiscontinuity, 0);
    assert(
        fast.retainedDistanceAtCameraRest < 0.015,
        "Expected retained curtain target to be effectively developed "
            + `at camera rest, got ${fast.retainedDistanceAtCameraRest}`
    );
    assert(
        fast.distance > previousGain.distance * 1.2,
        `Expected gain 1.75 travel ${fast.distance} to exceed gain 1.25 `
            + `travel ${previousGain.distance} by at least 20%`
    );
    assert(
        fast.openingAtRelease > fast.finalOpening,
        "Expected following folds to retain a visible closing movement"
    );
    assert(
        fast.openingAtRelease >= 0.79
            && fast.openingAtRelease <= 0.81,
        `Expected the saturated temporary opening near 0.8, got `
            + fast.openingAtRelease
    );
    assert(
        fast.finalOpening >= 0.67 && fast.finalOpening <= 0.69,
        `Expected retained opening to remain well above 0.5, got `
            + fast.finalOpening
    );
    assert(
        Math.abs(fast.openingAtCameraRest - fast.finalOpening) < 0.01,
        "Expected retained opening to be developed by camera rest"
    );
    closeTo(gentle.distance, gentleWithoutInertia.distance);
    closeTo(fast.right, fastWithoutInertia.right);
    closeTo(fast.left, fastWithoutInertia.left);
    assert(
        fast.frameCount > gentle.frameCount,
        "Expected a fast flick to run for more frames"
    );
});

test("zero directional retention restores the captured state exactly", () => {
    const field = new CurtainField({ resetCurtainState: 0.5 });
    field.configureFor(1000, 100);
    const application = new SimoneApplication({
        artworkLoader: null,
        parameters: new SurfaceParameters(),
        curtainField: field,
        viewport: createViewport(300),
        phaseResolver: null,
        surfaces: null,
        shading: null,
        renderer: null
    });
    application.artwork = {};
    application.render = () => {};
    field.resolve(application.parameters);
    const interaction = application.beginTouchExploration(200);
    const animation = captureAnimationFrames();

    assert(application.updateTouchExploration(
        interaction,
        0,
        0.04,
        -0.02
    ));
    assert(application.settleTouchExploration(
        interaction,
        0.04,
        -0.02,
        0,
        3,
        0,
        1,
        4,
        360
    ));
    animation.runNext(0);
    animation.runNext(360);
    field.periods.forEach((period) => {
        equal(period.visibleFactor, 0.5);
    });
    animation.restore();
});

test("a new curtain interaction restores EXPLORE after READ", () => {
    const application = createApplication(createViewport(0));
    application.attentionMode = "read";

    assert(application.beginLocalInteraction(100));
    equal(application.attentionMode, "explore");
});

test("crest lifecycle follows each Period instead of the dragged scene proxy", () => {
    const parameters = new SurfaceParameters();
    const shading = new SurfaceShading();
    const neutral = parameters.resolve(0.5);
    const fullyOpened = parameters.resolve(
        parameters.maximumVisibleFactor
    );

    assert(shading.crestLifecycleFor(neutral) > 0);
    equal(shading.crestLifecycleFor(fullyOpened), 0);
    assert(shading.crestLifecycleFor(neutral) > 0);
});

test("Moses gently opens, holds, and restores the exact prior state", () => {
    const field = new CurtainField({ resetCurtainState: 0.5 });
    field.configureFor(1000, 100);
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
    application.render = () => {};
    field.resolve(application.parameters);
    const startingFactors = field.periods.map(
        (period) => period.visibleFactor
    );
    const interaction = Object.freeze({
        periodIndex: 3,
        localPosition: 0.5,
        visibleFactors: Object.freeze(startingFactors)
    });
    const animation = captureAnimationFrames();

    assert(application.revealLocalInteraction(interaction));
    animation.runNext(0);
    animation.runNext(100);
    assert(field.periods[3].visibleFactor > startingFactors[3]);
    equal(field.periods[9].visibleFactor, startingFactors[9]);
    assert(field.periods.every((period) => period.visibleFactor < 1));
    animation.runNext(340);
    assert(field.periods[1].visibleFactor > startingFactors[1]);
    assert(field.periods[5].visibleFactor > startingFactors[5]);
    closeTo(field.periods[1].visibleFactor, field.periods[5].visibleFactor);
    animation.runNext(700);
    assert(field.periods[3].visibleFactor > startingFactors[3]);
    animation.runNext(1200);
    assert(field.periods[3].visibleFactor > startingFactors[3]);
    animation.runNext(1800);
    field.periods.forEach((period, index) => {
        equal(period.visibleFactor, startingFactors[index]);
    });
    equal(application.localRevealFrame, null);
    application.attentionMode = "read";
    assert(!application.revealLocalInteraction(interaction));
    animation.restore();
});

test("drag cancels Moses and restores its exact pre-click curtain state", () => {
    const field = new CurtainField({ resetCurtainState: 0.5 });
    field.configureFor(1000, 100);
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
    application.render = () => {};
    field.resolve(application.parameters);
    const interaction = field.beginLocalInteraction(350);
    const startingFactors = field.periods.map(
        (period) => period.visibleFactor
    );
    const animation = captureAnimationFrames();

    assert(application.revealLocalInteraction(interaction));
    animation.runNext(0);
    animation.runNext(300);
    const dragInteraction = application.beginLocalInteraction(200);

    for (let index = 0; index < field.periods.length; index += 1) {
        equal(field.periods[index].visibleFactor, startingFactors[index]);
        equal(dragInteraction.visibleFactors[index], startingFactors[index]);
    }
    equal(application.localRevealFrame, null);
    animation.restore();
});

test("clicked projected artwork resolves to its semantic project", () => {
    const application = createApplication(createViewport(0));
    application.artwork = {
        sourceXForSemanticX: (semanticX) => semanticX
    };
    application.semanticImageWidth = 1000;
    application.projectNavigation = {
        enabled: true,
        projects: [
            { title: "First", artworkStart: 0, artworkEnd: 3 },
            { title: "Second", artworkStart: 3, artworkEnd: 6 }
        ]
    };
    application.projectedColumns = [
        { placement: { targetX: 10 }, width: 10 },
        { placement: { targetX: 20 }, width: 10 },
        { placement: { targetX: 30 }, width: 10 },
        { placement: { targetX: 40 }, width: 10 },
        { placement: { targetX: 50 }, width: 10 },
        { placement: { targetX: 60 }, width: 10 }
    ];

    equal(application.projectAtPresentationX(45)?.title, "Second");
    equal(application.projectAtPresentationX(5), null);
});

test("desktop reframing settles by half a viewport with smootherstep", () => {
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
    animation.runNext(275);
    closeTo(viewport.projectedOffset, 200);
    animation.runNext(550);
    closeTo(viewport.projectedOffset, 300);
    equal(renderedFrames, 3);
    equal(synchronizedFrames, 3);
    animation.restore();
});

test("desktop reframe uses smootherstep without changing its target", () => {
    const viewport = createViewport(100);
    const application = createApplication(viewport);
    const animation = captureAnimationFrames();
    application.render = () => {};

    assert(application.reframeHorizontal(1, {}));
    animation.runNext(0);
    animation.runNext(137.5);
    closeTo(viewport.projectedOffset, 120.703125);
    animation.runNext(550);
    closeTo(viewport.projectedOffset, 300);
    animation.restore();
});

test("shared viewport animation retains smoothstep outside desktop reframe", () => {
    const viewport = createViewport(100);
    const application = createApplication(viewport);
    const animation = captureAnimationFrames();
    application.render = () => {};

    assert(application.animateViewportToProjectedOffset(300));
    animation.runNext(0);
    animation.runNext(112.5);
    closeTo(viewport.projectedOffset, 131.25);
    animation.runNext(550);
    closeTo(viewport.projectedOffset, 300);
    animation.restore();
});

test("reframing is shortened at viewport bounds", () => {
    const viewport = createViewport(950);
    const application = createApplication(viewport, 1000);
    const animation = captureAnimationFrames();
    application.render = () => {};

    assert(application.reframeHorizontal(1, {}));
    animation.runNext(0);
    animation.runNext(550);
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
    animation.runNext(550);
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
    animation.runNext(550);
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

test("desktop curtain inertia and camera reframe run and cancel independently", () => {
    const viewport = createViewport(100);
    const application = createApplication(viewport);
    const animation = captureAnimationFrames();
    const displacements = [];
    equal(application.desktopCurtainDirectDragScale(), 0.5);
    equal(application.desktopCurtainNeighborReach(), 40);
    application.updateLocalInteraction = (interaction, displacement) => {
        void interaction;
        displacements.push(displacement);
    };
    application.render = () => {};

    assert(application.startDesktopCurtainInertia(
        { periodIndex: 3 },
        100,
        1
    ));
    assert(application.reframeHorizontal(1, {}));
    animation.runNext(0);
    animation.runNext(0);
    animation.runNext(16);
    animation.runNext(275);
    animation.runNext(32);

    assert(displacements.length === 2);
    assert(displacements[0] > 100);
    assert(displacements[1] > displacements[0]);
    closeTo(viewport.projectedOffset, 200);
    const displacementBeforeCancellation = displacements.at(-1);
    application.beginLocalInteraction(100);
    equal(application.desktopCurtainInertiaFrame, null);
    equal(application.horizontalReframeFrame, null);
    equal(displacements.at(-1), displacementBeforeCancellation);
    animation.restore();
});

test("desktop inertia opens the grabbed Period in either release direction", () => {
    const factorAfterRelease = (direction) => {
        const field = new CurtainField({ resetCurtainState: 0.5 });
        const parameters = new SurfaceParameters();
        field.configureFor(201 * 100, 100);
        field.resolve(parameters);
        const periodWidth = parameters.resolve(0.5).projectedCarrierSpacing;
        const interaction = field.beginLocalInteraction(
            100.5 * periodWidth,
            40
        );
        const application = new SimoneApplication({
            artworkLoader: null,
            parameters,
            curtainField: field,
            viewport: createViewport(0),
            phaseResolver: null,
            surfaces: null,
            shading: null,
            renderer: null
        });
        application.artwork = {};
        application.render = () => {};
        const animation = captureAnimationFrames();

        assert(application.startDesktopCurtainInertia(
            interaction,
            direction * 50,
            direction
        ));
        animation.runNext(0);
        animation.runNext(16);
        const factor = field.periods[interaction.periodIndex].visibleFactor;
        application.cancelDesktopCurtainInertia();
        animation.restore();
        return factor;
    };
    const positive = factorAfterRelease(1);
    const negative = factorAfterRelease(-1);

    assert(positive > 0.5);
    closeTo(negative, positive);
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

test("desktop neighbor reach changes only its captured local interaction", () => {
    const field = new CurtainField({ resetCurtainState: 0.5 });
    const parameters = new SurfaceParameters();
    field.configureFor(201 * 120, 120);
    field.resolve(parameters);
    const periodWidth = parameters.resolve(0.5).projectedCarrierSpacing;
    const interaction = field.beginLocalInteraction(
        100.5 * periodWidth,
        40
    );

    equal(interaction.neighborReach, 40);
    field.applyLocalDisplacement(interaction, 120, 120, 0.2, 1);
    equal(
        field.periods.filter((period) => period.visibleFactor !== 0.5).length,
        81
    );

    field.setResetCurtainState(0.5);
    field.resolve(parameters);
    const productionInteraction = field.beginLocalInteraction(
        100.5 * periodWidth
    );
    equal(productionInteraction.neighborReach, 50);
});

test("symmetric grabbed opening remains valid at curtain boundaries", () => {
    const parameters = new SurfaceParameters();
    const factorFor = (projectedX, displacement) => {
        const field = new CurtainField({ resetCurtainState: 0.5 });
        field.configureFor(10 * 100, 100);
        field.resolve(parameters);
        const interaction = field.beginLocalInteraction(projectedX, 40);
        field.applyLocalDisplacement(
            interaction,
            displacement,
            100,
            0.2,
            1
        );
        assert(field.periods.every(
            (period) => period.visibleFactor >= 0.2
                && period.visibleFactor <= 1
        ));
        return field.periods[interaction.periodIndex].visibleFactor;
    };
    const periodWidth = parameters.resolve(0.5).projectedCarrierSpacing;

    closeTo(factorFor(0, -100), 0.58);
    closeTo(factorFor(9.5 * periodWidth, 100), 0.58);
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

test("Index selection prioritizes its destination before Reset", () => {
    const application = createApplication(createViewport(0));
    const sequence = [];
    application.projectNavigation = {
        projects: [{ title: "Selected" }]
    };
    application.projectProjectionFor = () => ({
        requestedNavigationTarget: 720
    });
    application.prioritizeArtworkForDestination = (target) => {
        sequence.push(["priority", target]);
    };
    application.animateResetCurtainState = () => {
        sequence.push(["reset"]);
        return true;
    };

    assert(application.resetAndNavigateToProject(0));
    equal(sequence[0][0], "priority");
    equal(sequence[0][1], 720);
    equal(sequence[1][0], "reset");
});

test("desktop project landing remains centered for wide and narrow projects", () => {
    const application = semanticNavigationApplication(false);
    const wide = application.projectProjectionFor({
        artworkStart: 300,
        artworkEnd: 900
    });
    const narrow = application.projectProjectionFor({
        artworkStart: 500,
        artworkEnd: 700
    });

    closeTo(wide.requestedNavigationTarget, 440);
    closeTo(narrow.requestedNavigationTarget, 440);
    closeTo(wide.requestedNavigationTarget, wide.requestedCenteredTarget);
    closeTo(narrow.requestedNavigationTarget, narrow.requestedCenteredTarget);
});

test("mobile project landing aligns its leading gutter for any project width", () => {
    const application = semanticNavigationApplication(true);
    const wide = application.projectProjectionFor({
        artworkStart: 300,
        artworkEnd: 900
    });
    const narrow = application.projectProjectionFor({
        artworkStart: 500,
        artworkEnd: 700
    });

    closeTo(wide.requestedNavigationTarget, 300);
    closeTo(narrow.requestedNavigationTarget, 500);
    closeTo(wide.requestedNavigationTarget, wide.requestedNextTarget);
    closeTo(narrow.requestedNavigationTarget, narrow.requestedNextTarget);
});

test("NEXT and Index selection share the responsive project target", () => {
    const application = semanticNavigationApplication(true);
    const targets = [];
    application.animateViewportToProjectedOffset = (target) => {
        targets.push(target);
        return true;
    };
    application.animateResetCurtainState = (values, onFrame, onComplete) => {
        onComplete();
        return true;
    };
    application.setProjectNavigation({
        enabled: true,
        projects: [
            { title: "First", artworkStart: 0, artworkEnd: 200 },
            { title: "Second", artworkStart: 300, artworkEnd: 900 }
        ]
    });

    assert(application.navigateToNextProject());
    application.currentProjectIndex = 0;
    assert(application.resetAndNavigateToProject(1));
    equal(targets.length, 2);
    closeTo(targets[0], 300);
    closeTo(targets[1], 300);
});

test("mobile project landing retains first and last archive bounds", () => {
    const application = semanticNavigationApplication(true);
    const first = application.projectProjectionFor({
        artworkStart: 0,
        artworkEnd: 200
    });
    const last = application.projectProjectionFor({
        artworkStart: 1200,
        artworkEnd: 1400
    });

    closeTo(application.viewport.projectedOffsetAfterShift(
        first.requestedNavigationTarget
            - application.viewport.projectedOffset
    ), 0);
    closeTo(application.viewport.projectedOffsetAfterShift(
        last.requestedNavigationTarget
            - application.viewport.projectedOffset
    ), 1000);
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
    application.artwork.sourceXForSemanticX = (semanticX) => semanticX;
    application.semanticArtworkWidth = 1000;
    application.semanticImageWidth = 1000;
    application.geometryArtworkWidth = 1000;
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
    const prioritizedDestinations = [];
    application.prioritizeArtworkForDestination = (target) => {
        prioritizedDestinations.push(target);
    };

    assert(application.navigateToProject(
        1,
        null,
        "flat-semantic-span"
    ));
    closeTo(prioritizedDestinations[0], 340);
    animation.runNext(0);
    animation.runNext(450);
    equal(viewport.projectedOffset, 340);
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
    application.artwork.sourceXForSemanticX = (semanticX) => semanticX;
    application.semanticArtworkWidth = 1000;
    application.semanticImageWidth = 1000;
    application.geometryArtworkWidth = 1000;
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
    application.artwork.sourceXForSemanticX = (semanticX) => Math.floor(
        semanticX * 5000 / 4400
    );
    application.semanticArtworkWidth = 4400;
    application.semanticImageWidth = 4400;
    application.geometryArtworkWidth = 5000;
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

test("intrinsic geometry stays separate from semantic navigation width", () => {
    const application = createApplication(createViewport(0));
    application.curtainField = new CurtainField();
    application.parameters = new SurfaceParameters();
    application.render = () => {};
    application.initializeArtwork({
        width: 60_000,
        height: 2_500,
        imageCount: 12
    });

    equal(application.semanticImageWidth, 4_400);
    equal(application.semanticArtworkWidth, 52_800);
    equal(application.geometryArtworkWidth, 60_000);
    equal(application.curtainField.periods.length, 500);
});

test("viewport preserves the left bound and permits trailing white space", () => {
    const viewport = createViewport(100);

    viewport.shiftProjectedOffset(10_000);
    closeTo(viewport.projectedOffset, 1000);
    viewport.shiftProjectedOffset(-10_000);
    closeTo(viewport.projectedOffset, 0);
});

function createViewport(offset, contentEnd = 1000) {
    const viewport = new Viewport({
        projectedOffset: offset,
        projectedExtent: 400,
        presentationExtent: 400
    });
    viewport.setProjectedContentRange(0, contentEnd);
    return viewport;
}

function createApplication(
    viewport,
    grabbedProjectedX = 400,
    useLeadingProjectAlignment = false
) {
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
        renderer: null,
        useLeadingProjectAlignment
    });
    application.artwork = {};
    return application;
}

function semanticNavigationApplication(useLeadingProjectAlignment) {
    const application = createApplication(
        createViewport(100),
        400,
        useLeadingProjectAlignment
    );
    application.artwork = {
        width: 1400,
        sourceXForSemanticX: (semanticX) => semanticX
    };
    application.semanticArtworkWidth = 1400;
    application.semanticImageWidth = 1400;
    application.geometryArtworkWidth = 1400;
    application.projectedContentBounds = { start: 0, end: 1000 };
    application.projectedColumns = Array.from(
        { length: 1401 },
        (_, sourceX) => ({
            placement: {
                targetX: sourceX,
                periodIndex: Math.floor(sourceX / 100)
            },
            width: 1
        })
    );
    return application;
}

function createTouchCanvas() {
    const canvas = new EventTarget();
    canvas.width = 400;
    canvas.clientWidth = 400;
    canvas.clientLeft = 0;
    canvas.classList = document.createElement("div").classList;
    canvas.getBoundingClientRect = () => ({ left: 0 });
    const captures = new Set();
    canvas.setPointerCapture = (pointerId) => captures.add(pointerId);
    canvas.hasPointerCapture = (pointerId) => captures.has(pointerId);
    canvas.releasePointerCapture = (pointerId) => captures.delete(pointerId);
    return canvas;
}

function touchEvent(type, pointerId, clientX, clientY, timeStamp) {
    return pointerEvent(
        type,
        pointerId,
        clientX,
        clientY,
        timeStamp,
        "touch"
    );
}

function pointerEvent(
    type,
    pointerId,
    clientX,
    clientY,
    timeStamp,
    pointerType = "mouse"
) {
    const event = new Event(type, { cancelable: true });
    Object.defineProperties(event, {
        button: { value: 0 },
        pointerType: { value: pointerType },
        pointerId: { value: pointerId },
        clientX: { value: clientX },
        clientY: { value: clientY },
        timeStamp: { value: timeStamp }
    });
    return event;
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

function maximumFactorDifference(first, second) {
    assert(first && second, "Expected both factor collections");
    return first.reduce(
        (maximum, value, index) => Math.max(
            maximum,
            Math.abs(value - second[index])
        ),
        0
    );
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
