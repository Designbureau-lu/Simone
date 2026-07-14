/**
 * Rendering layer: displays source columns at computed placements.
 *
 * It draws only exact source pixels. Geometry and visibility are supplied as
 * data and the renderer never fabricates or edits the artwork.
 */
export class CanvasColumnRenderer {
    #canvas;
    #context;
    #rearRegions = [];
    #activeRearRegion = null;

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
        this.#context.imageSmoothingEnabled = false;
        this.#context.clearRect(0, 0, width, height);
        this.#rearRegions = [];
        this.#activeRearRegion = null;
    }

    drawColumn(column, placement, appearance) {
        if (appearance.branch !== "rear") {
            this.#finishRearRegion();
        }

        if (appearance.alpha <= 0) {
            this.#finishRearRegion();
            return;
        }

        const startX = Math.round(placement.x);
        const endX = Math.round(placement.x + placement.width);
        const destinationWidth = endX - startX;

        if (destinationWidth === 0) {
            return;
        }

        this.#context.save();
        this.#context.globalAlpha = appearance.alpha;
        this.#context.drawImage(
            column.source,
            column.sourceX,
            column.sourceY,
            column.width,
            column.height,
            startX,
            placement.y,
            destinationWidth,
            column.height
        );
        this.#context.restore();

        if (appearance.branch === "rear") {
            this.#extendRearRegion(
                startX,
                placement.y,
                destinationWidth,
                column.height,
                appearance.brightness
            );
        }
    }

    endFrame() {
        this.#finishRearRegion();

        if (this.#rearRegions.length === 0) {
            return;
        }

        this.#context.save();
        this.#context.globalCompositeOperation = "source-atop";

        for (const region of this.#rearRegions) {
            this.#context.fillStyle = `rgba(0, 0, 0, ${region.darkness})`;
            this.#context.fillRect(
                region.left,
                region.top,
                region.right - region.left,
                region.bottom - region.top
            );
        }

        this.#context.restore();
    }

    #extendRearRegion(x, y, width, height, brightness) {
        const left = Math.min(x, x + width);
        const right = Math.max(x, x + width);
        const bottom = y + height;
        const darkness = 1 - brightness;

        if (!this.#activeRearRegion) {
            this.#activeRearRegion = { left, right, top: y, bottom, darkness };
            return;
        }

        this.#activeRearRegion.left = Math.min(this.#activeRearRegion.left, left);
        this.#activeRearRegion.right = Math.max(this.#activeRearRegion.right, right);
        this.#activeRearRegion.top = Math.min(this.#activeRearRegion.top, y);
        this.#activeRearRegion.bottom = Math.max(
            this.#activeRearRegion.bottom,
            bottom
        );
        this.#activeRearRegion.darkness = Math.max(
            this.#activeRearRegion.darkness,
            darkness
        );
    }

    #finishRearRegion() {
        if (!this.#activeRearRegion) {
            return;
        }

        this.#rearRegions.push(this.#activeRearRegion);
        this.#activeRearRegion = null;
    }
}
