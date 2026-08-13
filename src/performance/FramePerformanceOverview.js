const SAMPLE_LIMIT = 120;
const FRAME_BUDGET_MS = 1000 / 60;
const CAPTURE_DURATION_MS = 5000;
const TIME_KEYS = Object.freeze([
    ["Frame", "totalTime"],
    ["Geometry", "geometryTime"],
    ["Period layout", "periodGeometryTime"],
    ["Viewport discovery", "viewportDiscoveryTime"],
    ["Column projection", "columnProjectionTime"],
    ["Selection", "viewportTime"],
    ["Canvas reset", "canvasResetTime"],
    ["Rendering", "renderingTime"],
    ["Shading", "overlayTime"]
]);

/** Rolling developer measurements for SIMONE's viewport-canvas renderer. */
export class FramePerformanceOverview {
    #output;
    #browser;
    #samples = [];
    #current = null;
    #canvas;
    #capture;
    #captureTimer = null;
    #captureEndsAt = null;
    #captureActive = false;
    #captureFrozen = false;

    constructor(element, browser, canvas = document.getElementById("canvas")) {
        const output = element?.querySelector("[data-performance-output]");
        const reset = element?.querySelector("[data-reset-worst]");
        const capture = element?.querySelector("[data-capture-performance]");

        if (!(output instanceof HTMLPreElement)
            || !(reset instanceof HTMLButtonElement)
            || !(capture instanceof HTMLButtonElement)
            || !(canvas instanceof HTMLCanvasElement)) {
            throw new Error("SIMONE performance controls are incomplete.");
        }

        this.#output = output;
        this.#browser = browser;
        this.#canvas = canvas;
        this.#capture = capture;
        capture.textContent = "CAPTURE 5s";
        reset.textContent = "Reset";
        capture.addEventListener("click", () => this.#startCapture());
        reset.addEventListener("click", () => this.#reset());
    }

    update(report) {
        const current = Object.freeze(report);
        if (this.#captureActive
            && performance.now() > this.#captureEndsAt) {
            this.#finishCapture();
            this.#current = current;
            return;
        }
        this.#current = current;
        if (this.#captureFrozen) {
            return;
        }
        this.#samples.push(report);
        if (!this.#captureActive && this.#samples.length > SAMPLE_LIMIT) {
            this.#samples.shift();
        }
        this.#render();
    }

    #reset() {
        window.clearTimeout(this.#captureTimer);
        this.#captureTimer = null;
        this.#captureEndsAt = null;
        this.#captureActive = false;
        this.#captureFrozen = false;
        this.#samples = [];
        this.#capture.textContent = "CAPTURE 5s";
        this.#render();
    }

    #startCapture() {
        window.clearTimeout(this.#captureTimer);
        this.#samples = [];
        this.#captureActive = true;
        this.#captureFrozen = false;
        this.#captureEndsAt = performance.now() + CAPTURE_DURATION_MS;
        this.#capture.textContent = "CAPTURING 5s…";
        this.#render();
        this.#captureTimer = window.setTimeout(
            () => this.#finishCapture(),
            CAPTURE_DURATION_MS
        );
    }

    #finishCapture() {
        this.#captureTimer = null;
        this.#captureEndsAt = null;
        this.#captureActive = false;
        this.#captureFrozen = true;
        this.#capture.textContent = "CAPTURE 5s";
        this.#renderCapture();
    }

    #render() {
        if (!this.#current) {
            return;
        }

        const current = this.#current;
        const rows = [
            "SIMONE — VIEWPORT CANVAS",
            `${"".padEnd(18)}${"Current".padStart(10)}`
                + `${"Median".padStart(10)}${"p95".padStart(10)}`,
            ...TIME_KEYS.map(([label, key]) => metricRow(
                `${label} (ms)`,
                current[key],
                percentile(this.#samples, key, 0.5),
                percentile(this.#samples, key, 0.95)
            )),
            "",
            valueRow("Samples", this.#samples.length),
            valueRow("Missed frames", missedFrames(this.#samples)),
            valueRow("Destination", current.destinationMode),
            valueRow("Browser", this.#browser),
            valueRow("DPR", format(current.pixelRatio, 2)),
            valueRow("Canvas", `${integer(current.canvasWidth)} × ${integer(current.canvasHeight)}`),
            valueRow("Destination px", integer(current.destinationPixelCount)),
            valueRow("Draw calls", integer(current.drawImageCalls)),
            valueRow("Selected cols", integer(current.visibleColumns)),
            valueRow("Projected cols", integer(current.projectedColumns)),
            valueRow("Artwork cols", integer(current.totalColumns)),
            valueRow("Periods", integer(current.periodCount))
        ];

        this.#output.textContent = rows.join("\n");
    }

    #renderCapture() {
        const current = this.#samples.at(-1) ?? this.#current;
        const canvasRect = this.#canvas.getBoundingClientRect();
        const rows = [
            "SIMONE — CAPTURE 5s — COMPLETE",
            valueRow("Browser / UA", userAgentSummary(
                this.#browser,
                navigator.userAgent
            )),
            valueRow("Viewport CSS", dimensions(
                window.innerWidth,
                window.innerHeight
            )),
            valueRow("DPR", format(current?.pixelRatio, 2)),
            valueRow("Canvas CSS", dimensions(
                canvasRect.width,
                canvasRect.height
            )),
            valueRow("Canvas backing", dimensions(
                this.#canvas.width,
                this.#canvas.height
            )),
            valueRow("Destination px", integer(
                current?.destinationPixelCount
            )),
            "",
            `${"".padEnd(18)}${"Median".padStart(10)}`
                + `${"p95".padStart(10)}`,
            ...TIME_KEYS.map(([label, key]) => captureMetricRow(
                `${label} (ms)`,
                percentile(this.#samples, key, 0.5),
                percentile(this.#samples, key, 0.95)
            )),
            "",
            valueRow("Samples", this.#samples.length),
            valueRow("Missed frames", missedFrames(this.#samples)),
            valueRow("Draw calls", integer(current?.drawImageCalls)),
            valueRow("Selected cols", integer(current?.visibleColumns)),
            valueRow("Projected cols", integer(current?.projectedColumns)),
            valueRow("Artwork cols", integer(current?.totalColumns)),
            valueRow("Periods", integer(current?.periodCount))
        ];

        this.#output.textContent = rows.join("\n");
    }
}

export function currentBrowserName() {
    const userAgent = navigator.userAgent;

    if (userAgent.includes("Firefox/")) {
        return "Firefox";
    }
    if (userAgent.includes("Edg/")) {
        return "Edge";
    }
    if (userAgent.includes("Chrome/") || userAgent.includes("CriOS/")) {
        return "Chrome";
    }
    if (userAgent.includes("Safari/")) {
        return "Safari";
    }

    return navigator.userAgentData?.brands?.[0]?.brand ?? "Unknown";
}

function percentile(samples, key, fraction) {
    if (samples.length === 0) {
        return NaN;
    }
    const values = samples
        .map((sample) => sample[key])
        .sort((left, right) => left - right);
    return values[Math.ceil(values.length * fraction) - 1];
}

function missedFrames(samples) {
    return samples.reduce(
        (total, sample) => total + Math.max(
            0,
            Math.ceil(sample.totalTime / FRAME_BUDGET_MS) - 1
        ),
        0
    );
}

function metricRow(label, current, median, p95) {
    return `${label.padEnd(18)}${format(current, 1).padStart(10)}`
        + `${format(median, 1).padStart(10)}${format(p95, 1).padStart(10)}`;
}

function captureMetricRow(label, median, p95) {
    return `${label.padEnd(18)}${format(median, 1).padStart(10)}`
        + `${format(p95, 1).padStart(10)}`;
}

function valueRow(label, value) {
    return `${label.padEnd(18)}${String(value).padStart(12)}`;
}

function format(value, digits) {
    return Number.isFinite(value) ? value.toFixed(digits) : "—";
}

function integer(value) {
    return Number.isFinite(value)
        ? Math.round(value).toLocaleString("en-US")
        : "—";
}

function dimensions(width, height) {
    return `${integer(width)} × ${integer(height)}`;
}

function userAgentSummary(browser, userAgent) {
    const platform = userAgent.match(/Android [^;)]+|(?:iPhone )?OS [\d_]+/)
        ?.[0]
        ?.replaceAll("_", ".");
    const version = userAgent.match(
        /(?:CriOS|Chrome|Version)\/[\d.]+/
    )?.[0];
    return [browser, platform, version].filter(Boolean).join(" · ");
}
