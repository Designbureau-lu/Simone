const WORST_HIGH_KEYS = Object.freeze([
    "totalTime",
    "geometryTime",
    "viewportTime",
    "renderingTime",
    "overlayTime"
]);

/** Developer-only, passive display of rendering benchmark measurements. */
export class PerformanceOverview {
    #output;
    #browser;
    #worst = null;
    #current = null;

    constructor(element, browser) {
        if (!(element instanceof HTMLElement)) {
            throw new TypeError("PerformanceOverview requires an HTML element.");
        }

        const output = element.querySelector("[data-performance-output]");
        const reset = element.querySelector("[data-reset-worst]");

        if (!(output instanceof HTMLPreElement)
            || !(reset instanceof HTMLButtonElement)) {
            throw new Error("PerformanceOverview controls are incomplete.");
        }

        this.#output = output;
        this.#browser = browser;
        reset.addEventListener("click", () => this.#resetWorst());
    }

    update(report) {
        this.#current = Object.freeze({
            ...report,
            browser: this.#browser,
            fps: report.totalTime > 0 ? 1000 / report.totalTime : 0
        });
        this.#recordWorst(this.#current);
        this.#render();
    }

    #recordWorst(report) {
        if (!this.#worst) {
            this.#worst = { ...report };
            return;
        }

        for (const key of WORST_HIGH_KEYS) {
            this.#worst[key] = Math.max(this.#worst[key], report[key]);
        }

        this.#worst.fps = Math.min(this.#worst.fps, report.fps);
    }

    #resetWorst() {
        this.#worst = null;
        this.#render();
    }

    #render() {
        if (!this.#current) {
            return;
        }

        const current = this.#current;
        const worst = this.#worst;

        this.#output.textContent = [
            "PERFORMANCE",
            metricHeader(),
            metricRow("Frame (ms)", current.totalTime, worst?.totalTime),
            metricRow("FPS", current.fps, worst?.fps),
            "",
            "TIME",
            metricRow("Geometry (ms)", current.geometryTime, worst?.geometryTime),
            metricRow("Selection (ms)", current.viewportTime, worst?.viewportTime),
            metricRow("Rendering (ms)", current.renderingTime, worst?.renderingTime),
            metricRow("Shading (ms)", current.overlayTime, worst?.overlayTime),
            "",
            "SCENE",
            valueRow("Browser", current.browser),
            valueRow("Images", integer(current.imageCount)),
            valueRow("Artwork cols", integer(current.totalColumns)),
            valueRow("Visible Factor", `${format(current.visibleFactor * 100, 1)}%`),
            valueRow("Carrier Distance", format(current.carrierDistance, 0)),
            "",
            "GEOMETRY",
            valueRow("Selected cols", integer(current.visibleColumns)),
            valueRow("Drawn cols", integer(current.drawImageCalls)),
            valueRow("Periods", integer(current.periodCount)),
            "",
            "CANVAS",
            `${integer(current.canvasWidth)} × ${integer(current.canvasHeight)}`,
            valueRow("Resize", current.backingStoreResized ? "Yes" : "No")
        ].join("\n");
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

function metricHeader() {
    return `${"".padEnd(20)}${"Current".padStart(10)}${"Worst".padStart(10)}`;
}

function metricRow(label, current, worst) {
    return `${label.padEnd(20)}${format(current, 1).padStart(10)}`
        + `${format(worst, 1).padStart(10)}`;
}

function valueRow(label, value) {
    return `${label.padEnd(20)}${String(value).padStart(10)}`;
}

function format(value, fractionDigits) {
    return Number.isFinite(value)
        ? value.toFixed(fractionDigits)
        : "—";
}

function integer(value) {
    return Number.isFinite(value)
        ? Math.round(value).toLocaleString("en-US")
        : "—";
}
