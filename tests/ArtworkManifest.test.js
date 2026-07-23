import {
    imageFilenamesFromManifest,
    imageSourcesForFilenames
} from "../src/application/startSimone.js";
import { loadArtwork } from "../src/artwork/loadArtwork.js";

const failures = [];
const filenames = imageFilenamesFromManifest([
    "# Curtain artwork",
    "",
    "Exposition été.jpg",
    "Exposition été 2.jpg",
    "   ",
    "# ignored.jpg",
    "Exposition été 12.jpg"
].join("\n"));

const expected = [
    "Exposition été.jpg",
    "Exposition été 2.jpg",
    "Exposition été 12.jpg"
];
check(
    filenames.length === expected.length
    && filenames.every((filename, index) => filename === expected[index]),
    "manifest order or filename preservation changed"
);
const sources = imageSourcesForFilenames(
    ["Exposition été 12.jpg"],
    "https://example.test/simone/"
);
check(
    sources[0].url
        === "https://example.test/simone/public/images/Exposition%20%C3%A9t%C3%A9%2012.jpg",
    "image URL did not preserve the application base path"
);

const originalConsoleError = console.error;
const loggedErrors = [];
console.error = (...values) => loggedErrors.push(values);

try {
    const artwork = await loadArtwork([
        imageSource("Première image.svg", 3),
        { name: "Image cassée.svg", url: "data:image/svg+xml,not-svg" },
        imageSource("Troisième image.svg", 5)
    ]);
    check(artwork.width === 8, "successful images were not assembled");
    check(
        loggedErrors.some((values) => String(values[0])
            .includes("Image cassée.svg")),
        "failed image filename was not reported"
    );
} finally {
    console.error = originalConsoleError;
}

const passed = 4 - failures.length;
const summary = failures.length === 0
    ? "PASS 4/4"
    : `FAIL ${passed}/4\n${failures.join("\n")}`;

document.getElementById("results").textContent = summary;
document.title = summary.split("\n")[0];
console.log(summary);

function imageSource(name, width) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="2"></svg>`;
    return {
        name,
        url: `data:image/svg+xml,${encodeURIComponent(svg)}`
    };
}

function check(condition, message) {
    if (!condition) {
        failures.push(message);
    }
}
