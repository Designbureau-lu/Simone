/**
 * Rendering layer: displays source columns at computed placements.
 *
 * It draws only exact source pixels. Geometry and visibility are supplied as
 * data and the renderer never fabricates or edits the artwork.
 */
export class CanvasColumnRenderer {
    #canvas;
    #context;

    constructor(canvas) {
        if (!(canvas instanceof HTMLCanvasElement)) {
            throw new TypeError("CanvasColumnRenderer requires a canvas.");
        }

        const context = canvas.getContext("2d");
        if (!context) {
            throw new Error("A 2D rendering context is unavailable.");
        }

        this.#canvas = canvas;
        this.#context = context;
    }

    beginFrame({ width, height }) {
        this.#canvas.width = width;
        this.#canvas.height = height;
        this.#context.clearRect(0, 0, width, height);
    }

    drawColumn(column, placement, appearance) {
        this.#context.save();
        this.#context.drawImage(
            column.source,
            column.sourceX,
            column.sourceY,
            column.width,
            column.height,
            placement.x,
            placement.y,
            column.width,
            column.height
        );
        this.#context.globalCompositeOperation = "source-atop";
        this.#context.fillStyle = `rgba(0, 0, 0, ${1 - appearance.opacity})`;
        this.#context.fillRect(
            placement.x,
            placement.y,
            column.width,
            column.height
        );
        this.#context.restore();
    }

    endFrame() {
        // Placeholder for future frame-level diagnostics or render finalization.
    }
}
