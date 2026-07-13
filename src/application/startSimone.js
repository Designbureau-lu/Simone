import { loadArtwork } from "../artwork/loadArtwork.js";
import { ContactedFoldSurface } from "../geometry/ContactedFoldSurface.js";
import { MorphingSurface } from "../geometry/MorphingSurface.js";
import { RegimeResolver, SurfaceRegime } from "../geometry/RegimeResolver.js";
import { CanvasColumnRenderer } from "../rendering/CanvasColumnRenderer.js";
import { SurfaceShading } from "../shading/SurfaceShading.js";
import { SurfaceParameters } from "../surface/SurfaceParameters.js";
import { SimoneApplication } from "./SimoneApplication.js";

/** Composition root for the existing surface architecture. */
export function startSimone() {
    const fileInput = document.getElementById("fileInput");
    const canvas = document.getElementById("canvas");
    const controls = getSurfaceControls();

    if (!(fileInput instanceof HTMLInputElement) || !(canvas instanceof HTMLCanvasElement)) {
        throw new Error("SIMONE could not find its required interface elements.");
    }

    const morphingSurface = new MorphingSurface();
    const application = new SimoneApplication({
        artworkLoader: loadArtwork,
        parameters: new SurfaceParameters(),
        regimeResolver: new RegimeResolver(),
        surfaces: Object.freeze({
            [SurfaceRegime.SEPARATED_FOLD]: morphingSurface,
            [SurfaceRegime.CLOSURE_REGIME]: morphingSurface,
            [SurfaceRegime.CONTACTED_FOLD]: new ContactedFoldSurface()
        }),
        shading: new SurfaceShading(),
        renderer: new CanvasColumnRenderer(canvas)
    });

    bindSurfaceControls(controls, application);

    fileInput.addEventListener("change", async (event) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        try {
            await application.importArtwork(file);
        } catch (error) {
            console.error("SIMONE could not import the artwork.", error);
        }
    });

    return application;
}

function getSurfaceControls() {
    const controls = {
        closedLimit: getControlPair("closedLimit"),
        openLimit: getControlPair("openLimit"),
        currentPosition: getControlPair("currentPosition"),
        amplitude: getControlPair("amplitude"),
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
            closedLimit: Number(controls.closedLimit.range.value) / 100,
            openLimit: Number(controls.openLimit.range.value) / 100,
            currentPosition: Number(controls.currentPosition.number.value) / 100,
            amplitude: Number(controls.amplitude.range.value),
            carrierDistance: Number(controls.carrierDistance.range.value),
            modelTransition: Number(controls.modelTransition.range.value) / 100
        });
    };

    bindControlPair(controls.closedLimit, () => {
        constrainPositionControls(controls, "closed");
        updateApplication();
    });
    bindControlPair(controls.openLimit, () => {
        constrainPositionControls(controls, "open");
        updateApplication();
    });
    bindCurrentPositionControl(controls, updateApplication);
    bindControlPair(controls.amplitude, updateApplication);
    bindControlPair(controls.carrierDistance, updateApplication);
    bindControlPair(controls.modelTransition, updateApplication);

    constrainPositionControls(controls);
    updateApplication();
}

function constrainPositionControls(controls, changedBoundary) {
    let closed = Number(controls.closedLimit.range.value);
    let open = Number(controls.openLimit.range.value);

    if (closed > open && changedBoundary === "closed") {
        open = closed;
        setControlPairValue(controls.openLimit, open);
    } else if (open < closed && changedBoundary === "open") {
        closed = open;
        setControlPairValue(controls.closedLimit, closed);
    }

    controls.currentPosition.number.min = String(closed);
    controls.currentPosition.number.max = String(open);

    const current = clamp(Number(controls.currentPosition.number.value), closed, open);
    setCurrentPositionFromPhysical(controls, current);
}

function bindCurrentPositionControl(controls, onUpdate) {
    const pair = controls.currentPosition;

    pair.range.addEventListener("input", () => {
        const closed = Number(controls.closedLimit.range.value);
        const open = Number(controls.openLimit.range.value);
        const progress = Number(pair.range.value) / 100;
        pair.number.value = formatPosition(closed + progress * (open - closed));
        onUpdate();
    });

    const updateFromNumber = () => {
        const closed = Number(controls.closedLimit.range.value);
        const open = Number(controls.openLimit.range.value);
        setCurrentPositionFromPhysical(
            controls,
            clamp(Number(pair.number.value), closed, open)
        );
        onUpdate();
    };

    pair.number.addEventListener("input", updateFromNumber);
    pair.number.addEventListener("change", updateFromNumber);
}

function setCurrentPositionFromPhysical(controls, physicalPosition) {
    const closed = Number(controls.closedLimit.range.value);
    const open = Number(controls.openLimit.range.value);
    const range = open - closed;
    const progress = range === 0 ? 0 : (physicalPosition - closed) / range;

    controls.currentPosition.range.value = String(progress * 100);
    controls.currentPosition.number.value = formatPosition(physicalPosition);
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
