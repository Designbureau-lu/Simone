import {
    imageFilenamesFromManifest,
    imageSourcesForFilenames,
    manifestUrlFor
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
check(
    manifestUrlFor("public/projects.txt", "http://localhost:8000/")
        .searchParams.has("t"),
    "development manifest URL was not cache-busted"
);
check(
    !manifestUrlFor("public/projects.txt", "https://example.test/simone/")
        .searchParams.has("t"),
    "production manifest URL was unexpectedly cache-busted"
);

const originalConsoleError = console.error;
const loggedErrors = [];
console.error = (...values) => loggedErrors.push(values);

try {
    const artwork = await loadArtwork([
        imageSource("Première image.svg", 3, 2),
        { name: "Image cassée.svg", url: "data:image/svg+xml,not-svg" },
        imageSource("Troisième image.svg", 5, 4)
    ]);
    check(artwork.width === 8, "virtual artwork width is not continuous");
    check(artwork.height === 4, "different source heights were not preserved");
    check(artwork.imageCount === 2, "successful source count changed");
    const firstLastColumn = artwork.columnAt(2);
    const secondFirstColumn = artwork.columnAt(3);
    check(
        firstLastColumn.source !== secondFirstColumn.source,
        "segment boundary did not switch decoded sources"
    );
    check(firstLastColumn.sourceX === 2, "first source coordinate changed");
    check(secondFirstColumn.sourceX === 0, "second source did not start at zero");
    check(
        firstLastColumn.artworkX === 2 && secondFirstColumn.artworkX === 3,
        "continuous virtual coordinates changed at a segment boundary"
    );
    check(
        firstLastColumn.height === 2 && secondFirstColumn.height === 4,
        "individual source heights were not preserved"
    );
    check(
        artwork.columnAt(2) === firstLastColumn,
        "immutable column descriptor was recreated"
    );
    check(
        loggedErrors.some((values) => String(values[0])
            .includes("Image cassée.svg")),
        "failed image filename was not reported"
    );
} finally {
    console.error = originalConsoleError;
}

const passed = 14 - failures.length;
const summary = failures.length === 0
    ? "PASS 14/14"
    : `FAIL ${passed}/14\n${failures.join("\n")}`;

document.getElementById("results").textContent = summary;
document.title = summary.split("\n")[0];
console.log(summary);

function imageSource(name, width, height) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"></svg>`;
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
