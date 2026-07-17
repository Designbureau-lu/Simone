/** Prototype-only copy of the renderer with viewing-space destination height. */
export class ModelCCanvasColumnRenderer {
    #canvas;
    #context;
    #rearRegions = [];
    #activeRearRegion = null;
    #foldRegions = [];
    #activeFoldRegion = null;
    #appearance;
    #drawImageCalls = 0;
    #backingStoreResized = false;

    constructor(canvas) {
        if (!(canvas instanceof HTMLCanvasElement)) {
            throw new TypeError("ModelCCanvasColumnRenderer requires a canvas.");
        }

        const context = canvas.getContext("2d");
        if (!context) {
            throw new Error("A 2D rendering context is unavailable.");
        }

        this.#canvas = canvas;
        this.#context = context;
    }

    beginFrame({ width, height }, appearance) {
        this.#backingStoreResized = this.#canvas.width !== width
            || this.#canvas.height !== height;
        this.#canvas.width = width;
        this.#canvas.height = height;
        this.#appearance = appearance;
        this.#drawImageCalls = 0;
        this.#context.imageSmoothingEnabled = false;
        this.#context.clearRect(0, 0, width, height);
        this.#rearRegions = [];
        this.#activeRearRegion = null;
        this.#foldRegions = [];
        this.#activeFoldRegion = null;
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
            placement.height
        );
        this.#drawImageCalls += 1;
        this.#context.restore();

        this.#extendFoldRegion(
            startX,
            placement.y,
            destinationWidth,
            placement.height,
            appearance.branch,
            appearance.localSlope,
            appearance.foldProgress
        );
        if (appearance.branch === "rear") {
            this.#extendRearRegion(
                startX,
                placement.y,
                destinationWidth,
                placement.height,
                appearance.brightness
            );
        }
    }

    endFrame() {
        this.#finishRearRegion();
        this.#finishFoldRegion();

        if (this.#rearRegions.length > 0) {
            this.#context.save();
            this.#context.globalCompositeOperation = "source-atop";
            for (const region of this.#rearRegions) {
                this.#context.fillStyle = colorWithOpacity(
                    this.#appearance.rearDarkening.color,
                    region.darkness
                );
                this.#context.fillRect(
                    region.left,
                    region.top,
                    region.right - region.left,
                    region.bottom - region.top
                );
            }
            this.#context.restore();
        }

        this.#drawFoldCues();
        return Object.freeze({
            canvasWidth: this.#canvas.width,
            canvasHeight: this.#canvas.height,
            drawImageCalls: this.#drawImageCalls,
            backingStoreResized: this.#backingStoreResized
        });
    }

    #drawFoldCues() {
        if (this.#foldRegions.length === 0) {
            return;
        }
        this.#context.save();
        this.#context.globalCompositeOperation = "source-atop";
        for (const region of this.#foldRegions) {
            this.#drawValleyShadow(region);
            this.#drawCrestHighlight(region);
        }
        this.#context.restore();
    }

    #drawCrestHighlight(region) {
        const settings = this.#appearance.crestHighlight;
        const foldWidth = region.right - region.left;
        const width = Math.max(
            settings.minimumWidth,
            Math.min(settings.maximumWidth, foldWidth * settings.widthFactor)
        );
        const left = region.crestX - width / 2;
        const gradient = this.#context.createLinearGradient(
            left,
            0,
            left + width,
            0
        );
        addGradientStops(gradient, settings);
        this.#context.fillStyle = gradient;
        this.#context.fillRect(
            region.left,
            region.top,
            foldWidth,
            region.bottom - region.top
        );
    }

    #drawValleyShadow(region) {
        const settings = this.#appearance.valleyShadow;
        const gradient = this.#context.createLinearGradient(
            region.left,
            0,
            region.right,
            0
        );
        addGradientStops(gradient, settings, region.foldProgress);
        this.#context.fillStyle = gradient;
        this.#context.fillRect(
            region.left,
            region.top,
            region.right - region.left,
            region.bottom - region.top
        );
    }

    #extendFoldRegion(
        x,
        y,
        width,
        height,
        branch,
        localSlope,
        foldProgress
    ) {
        if (this.#startsNewFold(branch, localSlope)) {
            this.#finishFoldRegion();
        }
        const left = Math.min(x, x + width);
        const right = Math.max(x, x + width);
        const center = (left + right) / 2;
        const bottom = y + height;

        if (!this.#activeFoldRegion) {
            this.#activeFoldRegion = {
                branch,
                left,
                right,
                top: y,
                bottom,
                crestX: center,
                crestSlope: Math.abs(localSlope),
                crestSampleCount: 1,
                previousSlope: localSlope,
                foldProgress
            };
            return;
        }

        const region = this.#activeFoldRegion;
        region.left = Math.min(region.left, left);
        region.right = Math.max(region.right, right);
        region.top = Math.min(region.top, y);
        region.bottom = Math.max(region.bottom, bottom);
        region.previousSlope = localSlope;
        const absoluteSlope = Math.abs(localSlope);
        if (absoluteSlope < region.crestSlope - Number.EPSILON) {
            region.crestX = center;
            region.crestSlope = absoluteSlope;
            region.crestSampleCount = 1;
        } else if (Math.abs(absoluteSlope - region.crestSlope)
            <= Number.EPSILON) {
            region.crestX = (
                region.crestX * region.crestSampleCount + center
            ) / (region.crestSampleCount + 1);
            region.crestSampleCount += 1;
        }
    }

    #startsNewFold(branch, localSlope) {
        const region = this.#activeFoldRegion;
        if (!region || branch !== region.branch) {
            return Boolean(region);
        }
        return branch === "front"
            ? region.previousSlope > 0 && localSlope <= 0
            : region.previousSlope < 0 && localSlope >= 0;
    }

    #finishFoldRegion() {
        if (!this.#activeFoldRegion) {
            return;
        }
        this.#foldRegions.push(this.#activeFoldRegion);
        this.#activeFoldRegion = null;
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

function addGradientStops(gradient, settings, strengthFactor = 1) {
    for (const stop of settings.stops) {
        const opacity = settings.strength * stop.intensity * strengthFactor;
        gradient.addColorStop(
            stop.offset,
            colorWithOpacity(settings.color, opacity)
        );
    }
}

function colorWithOpacity(color, opacity) {
    const [red, green, blue] = color;
    return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}
