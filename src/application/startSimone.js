import { loadArtwork } from "../artwork/loadArtwork.js";
import { CircularFoldSurface } from "../geometry/CircularFoldSurface.js";
import {
    OperatingPhase,
    OperatingPhaseResolver
} from "../geometry/OperatingPhaseResolver.js";
import { CanvasColumnRenderer } from "../rendering/CanvasColumnRenderer.js";
import {
    currentBrowserName,
    PerformanceOverview
} from "../performance/PerformanceOverview.js";
import { SurfaceShading } from "../shading/SurfaceShading.js";
import { CurtainField } from "../surface/CurtainField.js";
import { SurfaceParameters } from "../surface/SurfaceParameters.js";
import { Viewport } from "../viewport/Viewport.js";
import { SimoneApplication } from "./SimoneApplication.js";

/** Composition root for the existing surface architecture. */
export function startSimone() {
    const fileInput = document.getElementById("fileInput");
    const canvas = document.getElementById("canvas");
    const viewportPosition = document.getElementById("viewportPositionInput");
    const viewportPositionValue = document.getElementById(
        "viewportPositionValue"
    );
    const performanceOverviewElement = document.getElementById(
        "performanceOverview"
    );
    const controls = getSurfaceControls();

    if (!(fileInput instanceof HTMLInputElement)
        || !(canvas instanceof HTMLCanvasElement)
        || !(viewportPosition instanceof HTMLInputElement)
        || !(viewportPositionValue instanceof HTMLOutputElement)
        || !(performanceOverviewElement instanceof HTMLElement)) {
        throw new Error("SIMONE could not find its required interface elements.");
    }

    const circularFoldSurface = new CircularFoldSurface();
    const application = new SimoneApplication({
        artworkLoader: loadArtwork,
        parameters: new SurfaceParameters(),
        curtainField: new CurtainField(),
        viewport: new Viewport({
            projectedOffset: 0,
            projectedExtent: 0
        }),
        phaseResolver: new OperatingPhaseResolver(),
        surfaces: Object.freeze({
            [OperatingPhase.PRE_TRANSITION]: circularFoldSurface,
            [OperatingPhase.TRANSITION]: circularFoldSurface,
            [OperatingPhase.POST_TRANSITION]: circularFoldSurface
        }),
        shading: new SurfaceShading(),
        renderer: new CanvasColumnRenderer(canvas),
        performanceOverview: new PerformanceOverview(
            performanceOverviewElement,
            currentBrowserName()
        )
    });

    bindSurfaceControls(controls, application);
    bindCurtainDragging(canvas, controls, application);
    bindViewportControl(
        viewportPosition,
        viewportPositionValue,
        application
    );

    fileInput.addEventListener("change", async (event) => {
        const files = Array.from(event.target.files ?? []);
        if (files.length === 0) {
            return;
        }

        try {
            await application.importArtwork(files);
        } catch (error) {
            console.error("SIMONE could not import the artwork.", error);
        }
    });

    return application;
}

function bindViewportControl(input, output, application) {
    const update = () => {
        const position = Number(input.value);
        output.value = `${formatPosition(position)}%`;
        application.updateViewportPosition(position / 100);
    };

    input.addEventListener("input", update);
}

function getSurfaceControls() {
    const controls = {
        minimumVisibleFactor: getControlPair("minimumVisibleFactor"),
        maximumVisibleFactor: getControlPair("maximumVisibleFactor"),
        visibleFactor: getControlPair("visibleFactor"),
        carrierDistance: getControlPair("carrierDistance"),
        modelTransition: getControlPair("modelTransition")
    };

    if (Object.values(controls).some((pair) => !pair)) {
        throw new Error("SIMONE could not find its periodic surface controls.");
    }

    return controls;
}

function getControlPair(name) {
    const range = document.getElementById(`${name}Input`);
    const number = document.getElementById(`${name}Number`);

    if (!(range instanceof HTMLInputElement) || !(number instanceof HTMLInputElement)) {
        return null;
    }

    return Object.freeze({ range, number });
}

function bindSurfaceControls(controls, application) {
    const updateApplication = () => {
        application.updateSurface({
            minimumVisibleFactor:
                Number(controls.minimumVisibleFactor.range.value) / 100,
            maximumVisibleFactor:
                Number(controls.maximumVisibleFactor.range.value) / 100,
            visibleFactor: Number(controls.visibleFactor.number.value) / 100,
            carrierDistance: Number(controls.carrierDistance.range.value),
            modelTransition: Number(controls.modelTransition.range.value) / 100
        });
    };

    bindControlPair(controls.minimumVisibleFactor, () => {
        constrainVisibleFactorControls(controls, "minimum");
        updateApplication();
    });
    bindControlPair(controls.maximumVisibleFactor, () => {
        constrainVisibleFactorControls(controls, "maximum");
        updateApplication();
    });
    bindVisibleFactorControl(controls, updateApplication);
    bindControlPair(controls.carrierDistance, updateApplication);
    bindControlPair(controls.modelTransition, updateApplication);

    constrainVisibleFactorControls(controls);
    updateApplication();

    return updateApplication;
}

function bindCurtainDragging(canvas, controls, application) {
    let drag = null;

    canvas.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) {
            return;
        }

        const bounds = canvas.getBoundingClientRect();
        const width = bounds.width;
        if (width <= 0) {
            return;
        }

        const canvasScale = canvas.width / width;
        const targetX = (event.clientX - bounds.left) * canvasScale;
        const interaction = application.beginLocalInteraction(targetX);

        if (!interaction) {
            return;
        }

        drag = {
            pointerId: event.pointerId,
            startX: event.clientX,
            canvasScale,
            interaction
        };

        canvas.setPointerCapture(event.pointerId);
        canvas.classList.add("is-dragging");
        event.preventDefault();
    });

    canvas.addEventListener("pointermove", (event) => {
        if (!drag || event.pointerId !== drag.pointerId) {
            return;
        }

        const horizontalDisplacement = (
            event.clientX - drag.startX
        ) * drag.canvasScale;
        const visibleFactor = application.updateLocalInteraction(
            drag.interaction,
            horizontalDisplacement
        );
        const formattedValue = Number(formatPosition(visibleFactor * 100));

        if (formattedValue === Number(controls.visibleFactor.number.value)) {
            return;
        }

        setVisibleFactor(controls, formattedValue);
    });

    const finishDragging = (event) => {
        if (!drag || event.pointerId !== drag.pointerId) {
            return;
        }

        if (canvas.hasPointerCapture(event.pointerId)) {
            canvas.releasePointerCapture(event.pointerId);
        }

        drag = null;
        canvas.classList.remove("is-dragging");
    };

    canvas.addEventListener("pointerup", finishDragging);
    canvas.addEventListener("pointercancel", finishDragging);
}

function constrainVisibleFactorControls(controls, changedBoundary) {
    let minimum = Number(controls.minimumVisibleFactor.range.value);
    let maximum = Number(controls.maximumVisibleFactor.range.value);

    if (minimum > maximum && changedBoundary === "minimum") {
        maximum = minimum;
        setControlPairValue(controls.maximumVisibleFactor, maximum);
    } else if (maximum < minimum && changedBoundary === "maximum") {
        minimum = maximum;
        setControlPairValue(controls.minimumVisibleFactor, minimum);
    }

    controls.visibleFactor.number.min = String(minimum);
    controls.visibleFactor.number.max = String(maximum);

    const visibleFactor = clamp(
        Number(controls.visibleFactor.number.value),
        minimum,
        maximum
    );
    setVisibleFactor(controls, visibleFactor);
}

function bindVisibleFactorControl(controls, onUpdate) {
    const pair = controls.visibleFactor;

    pair.range.addEventListener("input", () => {
        const minimum = Number(controls.minimumVisibleFactor.range.value);
        const maximum = Number(controls.maximumVisibleFactor.range.value);
        const progress = Number(pair.range.value) / 100;
        pair.number.value = formatPosition(
            minimum + progress * (maximum - minimum)
        );
        onUpdate();
    });

    const updateFromNumber = () => {
        const minimum = Number(controls.minimumVisibleFactor.range.value);
        const maximum = Number(controls.maximumVisibleFactor.range.value);
        setVisibleFactor(
            controls,
            clamp(Number(pair.number.value), minimum, maximum)
        );
        onUpdate();
    };

    pair.number.addEventListener("input", updateFromNumber);
    pair.number.addEventListener("change", updateFromNumber);
}

function setVisibleFactor(controls, visibleFactor) {
    const minimum = Number(controls.minimumVisibleFactor.range.value);
    const maximum = Number(controls.maximumVisibleFactor.range.value);
    const range = maximum - minimum;
    const progress = range === 0 ? 0 : (visibleFactor - minimum) / range;

    controls.visibleFactor.range.value = String(progress * 100);
    controls.visibleFactor.number.value = formatPosition(visibleFactor);
}

function bindControlPair(pair, onUpdate) {
    const synchronize = (source, target) => {
        const value = Number(source.value);
        if (!Number.isFinite(value)) {
            return;
        }

        const minimum = Number(pair.range.min);
        const maximum = Number(pair.range.max);
        const clampedValue = clamp(value, minimum, maximum);

        source.value = String(clampedValue);
        target.value = String(clampedValue);
        onUpdate();
    };

    pair.range.addEventListener("input", () => synchronize(pair.range, pair.number));
    pair.number.addEventListener("input", () => synchronize(pair.number, pair.range));
    pair.number.addEventListener("change", () => synchronize(pair.number, pair.range));
    setControlPairValue(pair, pair.range.value);
}

function setControlPairValue(pair, value) {
    pair.range.value = String(value);
    pair.number.value = String(value);
}

function formatPosition(value) {
    return String(Number(value.toFixed(2)));
}

function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), maximum);
}
