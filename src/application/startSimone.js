import { loadArtwork } from "../artwork/loadArtwork.js";
import { WaveGeometry } from "../geometry/WaveGeometry.js";
import { CanvasColumnRenderer } from "../rendering/CanvasColumnRenderer.js";
import { ColumnVisibility } from "../visibility/ColumnVisibility.js";
import { SimoneApplication } from "./SimoneApplication.js";

/**
 * Composition root: connects concrete browser adapters to application logic.
 * DOM lookup and event binding stay here, outside the reusable core modules.
 */
export function startSimone() {
    const fileInput = document.getElementById("fileInput");
    const canvas = document.getElementById("canvas");

    if (!(fileInput instanceof HTMLInputElement) || !(canvas instanceof HTMLCanvasElement)) {
        throw new Error("SIMONE could not find its required interface elements.");
    }

    const application = new SimoneApplication({
        artworkLoader: loadArtwork,
        geometry: new WaveGeometry(),
        visibility: new ColumnVisibility(),
        renderer: new CanvasColumnRenderer(canvas)
    });

    fileInput.addEventListener("change", async (event) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        try {
            await application.importArtwork(file);
        } catch (error) {
            // The current interface has no error panel; preserve it and report diagnostically.
            console.error("SIMONE could not import the artwork.", error);
        }
    });

    return application;
}
