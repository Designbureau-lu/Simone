const WARM_UP_FRAMES = 10;
const MEASURED_FRAMES = 30;
const BLOCK_SIZE = 5;
const MODES = Object.freeze(["dynamic", "viewport"]);
const METRICS = Object.freeze([
    "totalTime",
    "geometryTime",
    "viewportTime",
    "canvasResetTime",
    "renderingTime",
    "overlayTime"
]);

/** Compare legacy destination allocation with the viewport canvas. */
export async function runModelCComparison(application) {
    if (!application.artwork) {
        throw new Error("Import artwork before running the comparison.");
    }

    try {
        for (const mode of MODES) {
            application.setDestinationMode(mode);
            for (let frame = 0; frame < WARM_UP_FRAMES; frame += 1) {
                await animationFrame();
                application.render();
            }
        }

        const samples = new Map(MODES.map((mode) => [mode, []]));
        for (let block = 0; block < MEASURED_FRAMES / BLOCK_SIZE; block += 1) {
            for (const mode of MODES) {
                application.setDestinationMode(mode);
                for (let frame = 0; frame < BLOCK_SIZE; frame += 1) {
                    await animationFrame();
                    samples.get(mode).push(application.render());
                }
            }
        }

        const results = MODES.map((mode) => summarize(mode, samples.get(mode)));
        console.table(results);
        return Object.freeze(results);
    } finally {
        application.setDestinationMode("viewport");
        application.render();
    }
}

function summarize(mode, samples) {
    const result = {
        Mode: mode,
        Frames: samples.length,
        Canvas: `${samples[0].canvasWidth} × ${samples[0].canvasHeight}`,
        "Destination px": samples[0].destinationPixelCount,
        "Draw calls": samples[0].drawImageCalls
    };

    for (const metric of METRICS) {
        result[`${metric} median`] = rounded(percentile(samples, metric, 0.5));
        result[`${metric} p95`] = rounded(percentile(samples, metric, 0.95));
    }

    result["Missed frames"] = samples.reduce(
        (total, sample) => total + Math.max(
            0,
            Math.ceil(sample.totalTime / (1000 / 60)) - 1
        ),
        0
    );
    return Object.freeze(result);
}

function percentile(samples, key, fraction) {
    const values = samples
        .map((sample) => sample[key])
        .sort((left, right) => left - right);
    return values[Math.ceil(values.length * fraction) - 1];
}

function rounded(value) {
    return Number(value.toFixed(2));
}

function animationFrame() {
    return new Promise((resolve) => requestAnimationFrame(resolve));
}
