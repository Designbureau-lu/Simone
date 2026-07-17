const SAMPLE_LIMIT = 120;
const FRAME_BUDGET_MS = 1000 / 60;
const TIME_KEYS = Object.freeze([
    ["Frame", "totalTime"],
    ["Geometry", "geometryTime"],
    ["Selection", "viewportTime"],
    ["Canvas reset", "canvasResetTime"],
    ["Rendering", "renderingTime"],
    ["Shading", "overlayTime"]
]);

/** Rolling Model C measurements; intentionally isolated from production UI. */
export class ModelCPerformanceOverview {
    #output;
    #browser;
    #samples = [];
    #current = null;

    constructor(element, browser) {
        const output = element?.querySelector("[data-performance-output]");
        const reset = element?.querySelector("[data-reset-worst]");

        if (!(output instanceof HTMLPreElement)
            || !(reset instanceof HTMLButtonElement)) {
            throw new Error("Model C performance controls are incomplete.");
        }

        this.#output = output;
        this.#browser = browser;
        reset.textContent = "Reset Samples";
        reset.addEventListener("click", () => this.#reset());
    }

    update(report) {
        this.#current = Object.freeze(report);
        this.#samples.push(report);
        if (this.#samples.length > SAMPLE_LIMIT) {
            this.#samples.shift();
        }
        this.#render();
    }

    #reset() {
        this.#samples = [];
        this.#render();
    }

    #render() {
        if (!this.#current) {
            return;
        }

        const current = this.#current;
        const rows = [
            "MODEL C — VIEWPORT CANVAS",
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
            valueRow("Artwork cols", integer(current.totalColumns)),
            valueRow("Periods", integer(current.periodCount))
        ];

        this.#output.textContent = rows.join("\n");
    }
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
