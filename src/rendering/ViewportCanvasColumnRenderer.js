const DEBUG_FOLD_REGIONS = ["1", "corrected"].includes(
    new URLSearchParams(window.location.search).get("debug-fold-regions")
);
const DEBUG_REGION_COLORS = Object.freeze([
    "rgba(0, 120, 255, 0.12)",
    "rgba(255, 170, 0, 0.12)",
    "rgba(0, 190, 120, 0.12)",
    "rgba(170, 80, 255, 0.12)"
]);
const DEBUG_RIDGE_COLOR = "rgba(255, 0, 0, 0.9)";

/** Canvas 2D renderer for globally placed columns in the guarded region. */
export class ViewportCanvasColumnRenderer {
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
            throw new TypeError(
                "ViewportCanvasColumnRenderer requires a canvas."
            );
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
        if (this.#backingStoreResized) {
            this.#canvas.width = width;
            this.#canvas.height = height;
        }
        this.#appearance = appearance;
        this.#drawImageCalls = 0;
        this.#context.globalAlpha = 1;
        this.#context.imageSmoothingEnabled = false;
        this.#context.clearRect(0, 0, width, height);
        this.#rearRegions = [];
        this.#activeRearRegion = null;
        this.#foldRegions = [];
        this.#activeFoldRegion = null;
    }

    drawColumn(column, placement, appearance) {
        if (this.#activeFoldRegion
            && (appearance.branch !== this.#activeFoldRegion.branch
                || appearance.periodIndex
                    !== this.#activeFoldRegion.periodIndex)) {
            this.#finishFoldRegion();
        }
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

        this.#extendFoldRegion(
            startX,
            placement.y,
            destinationWidth,
            placement.height,
            appearance.branch,
            appearance.localSlope,
            appearance.foldProgress,
            appearance.crestLifecycleMultiplier,
            appearance.periodIndex
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
        this.#context.globalAlpha = 1;

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
        this.#drawRegionDiagnostics();
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
            if (region.branch === "front") {
                this.#drawCrestHighlight(region);
            }
        }
        this.#context.restore();
    }

    #drawCrestHighlight(region) {
        const settings = this.#appearance.crestHighlight;
        const foldWidth = region.right - region.left;
        const width = foldWidth / 2;
        const left = region.ridgeX - width / 2;
        const gradient = this.#context.createLinearGradient(
            left,
            0,
            left + width,
            0
        );
        // Local geometry onset: suppresses flat/near-flat folds and saturates
        // early; the lifecycle, not slope, owns the full interaction envelope.
        const geometricMultiplier = Math.min(
            1,
            region.maximumAbsoluteSlope
        );
        // Local fold existence × this Period's lifecycle emphasis.
        const crestMultiplier = geometricMultiplier
            * region.crestLifecycleMultiplier;
        addRidgeGradientStops(gradient, settings, crestMultiplier);
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

    #drawRegionDiagnostics() {
        if (!DEBUG_FOLD_REGIONS || this.#foldRegions.length === 0) {
            return;
        }

        this.#context.save();
        this.#context.globalCompositeOperation = "source-atop";
        for (let index = 0; index < this.#foldRegions.length; index += 1) {
            const region = this.#foldRegions[index];
            this.#context.fillStyle = DEBUG_REGION_COLORS[
                index % DEBUG_REGION_COLORS.length
            ];
            this.#context.fillRect(
                region.left,
                region.top,
                region.right - region.left,
                region.bottom - region.top
            );
            this.#context.fillStyle = DEBUG_RIDGE_COLOR;
            this.#context.fillRect(
                Math.round(region.ridgeX) - 1,
                region.top,
                2,
                region.bottom - region.top
            );
        }
        this.#context.restore();
    }

    #extendFoldRegion(
        x,
        y,
        width,
        height,
        branch,
        localSlope,
        foldProgress,
        crestLifecycleMultiplier,
        periodIndex
    ) {
        if (this.#startsNewFold(branch, localSlope, periodIndex)) {
            this.#finishFoldRegion();
        }
        const left = Math.min(x, x + width);
        const right = Math.max(x, x + width);
        const center = (left + right) / 2;
        const bottom = y + height;

        if (!this.#activeFoldRegion) {
            this.#activeFoldRegion = {
                branch,
                periodIndex,
                left,
                right,
                top: y,
                bottom,
                ridgeX: center,
                ridgeSlope: Math.abs(localSlope),
                ridgeSampleCount: 1,
                maximumAbsoluteSlope: Math.abs(localSlope),
                previousSlope: localSlope,
                foldProgress,
                crestLifecycleMultiplier
            };
            return;
        }

        const region = this.#activeFoldRegion;
        region.left = Math.min(region.left, left);
        region.right = Math.max(region.right, right);
        region.top = Math.min(region.top, y);
        region.bottom = Math.max(region.bottom, bottom);
        region.previousSlope = localSlope;
        region.crestLifecycleMultiplier = Math.max(
            region.crestLifecycleMultiplier,
            crestLifecycleMultiplier
        );
        const absoluteSlope = Math.abs(localSlope);
        region.maximumAbsoluteSlope = Math.max(
            region.maximumAbsoluteSlope,
            absoluteSlope
        );
        if (absoluteSlope < region.ridgeSlope - Number.EPSILON) {
            region.ridgeX = center;
            region.ridgeSlope = absoluteSlope;
            region.ridgeSampleCount = 1;
        } else if (Math.abs(absoluteSlope - region.ridgeSlope)
            <= Number.EPSILON) {
            region.ridgeX = (
                region.ridgeX * region.ridgeSampleCount + center
            ) / (region.ridgeSampleCount + 1);
            region.ridgeSampleCount += 1;
        }
    }

    #startsNewFold(branch, localSlope, periodIndex) {
        const region = this.#activeFoldRegion;
        if (!region
            || branch !== region.branch
            || periodIndex !== region.periodIndex) {
            return Boolean(region);
        }
        // Do not split a continuous front branch solely on an internal
        // slope-sign reversal. Front folds are U-shaped in the corrected
        // geometry and must remain one coherent shading region so that
        // crest highlight and valley shadow are evaluated once.
        // Rear folds keep the previous slope-sign boundary behaviour.
        return branch === "front"
            ? false
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

    // Debug accessor used only by focused tests to verify region grouping.
    // Returns a shallow copy of the renderer's computed regions.
    getDebugRegions() {
        const crestHighlights = this.#foldRegions
            .filter((region) => region.branch === "front")
            .map((region) => {
                const width = (region.right - region.left) / 2;
                const cueLeft = region.ridgeX - width / 2;
                return {
                    branch: region.branch,
                    regionLeft: region.left,
                    regionRight: region.right,
                    ridgeX: region.ridgeX,
                    cueLeft,
                    cueRight: cueLeft + width
                };
            });
        const valleyShadows = this.#foldRegions.map((region) => ({
            branch: region.branch,
            left: region.left,
            right: region.right,
            top: region.top,
            bottom: region.bottom
        }));
        return {
            foldRegions: this.#foldRegions.slice(),
            rearRegions: this.#rearRegions.slice(),
            cueApplications: {
                crestHighlights,
                valleyShadows
            }
        };
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

function addRidgeGradientStops(gradient, settings, crestMultiplier) {
    for (const [offset, intensity] of [[0, 0], [0.5, 1], [1, 0]]) {
        gradient.addColorStop(
            offset,
            colorWithOpacity(
                settings.color,
                settings.strength * intensity * crestMultiplier
            )
        );
    }
}
