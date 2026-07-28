import { artworkLayout } from "../src/navigation/ArtworkLayout.js";
import {
    imageFilenamesFromManifest
} from "../src/application/startSimone.js";
import {
    createProjectNavigation,
    parseProjects
} from "../src/navigation/ProjectNavigation.js";

const tests = [];

test("central layout configuration defines the current logical unit", () => {
    equal(artworkLayout.gutterWidth, 40);
    equal(artworkLayout.columnWidth, 400);
    equal(artworkLayout.repetitionsPerImage, 10);
});

test("canonical surface defaults match the public tuning", async () => {
    const { SurfaceParameters } = await import(
        "../src/surface/SurfaceParameters.js"
    );
    const { CurtainField } = await import(
        "../src/surface/CurtainField.js"
    );
    const parameters = new SurfaceParameters();
    const curtain = new CurtainField();

    equal(parameters.minimumVisibleFactor, 0.2);
    equal(parameters.maximumVisibleFactor, 1);
    equal(parameters.carrierDistance, 120);
    equal(parameters.modelTransition, 0.5);
    equal(curtain.resetCurtainState, 0.5);
});

test("UTF-8 CSV parsing preserves quoted punctuation and validates spans", () => {
    const projects = parseProjects(
        "\uFEFF# comment\r\"Lenka, Denise, Charlotte,...\",3\rJérémy,2\u00a0\r"
    );
    equal(projects.length, 2);
    equal(projects[0].title, "Lenka, Denise, Charlotte,...");
    equal(projects[0].span, 3);
    equal(projects[1].title, "Jérémy");
    equal(projects[1].year, null);
    equal(projects[1].span, 2);
    throws(() => parseProjects("Invalid,1.5"));
    throws(() => parseProjects("Invalid,0"));
});

test("project year is optional metadata before the semantic span", () => {
    const projects = parseProjects("Dissolution,2024,3\nUndated,2");
    equal(projects[0].title, "Dissolution");
    equal(projects[0].year, "2024");
    equal(projects[0].span, 3);
    equal(projects[1].year, null);
});

test("project coordinates derive from logical units, not image dimensions", () => {
    const navigation = createProjectNavigation({
        source: "Alpha,3\nBeta,2",
        loadedImageCount: 1
    });
    equal(navigation.totalUnits, 10);
    equal(navigation.projectSpanUnits, 5);
    equal(navigation.unusedUnits, 5);
    equal(navigation.projects[0].startUnit, 0);
    equal(navigation.projects[0].endUnit, 3);
    equal(navigation.projects[0].artworkStart, 0);
    equal(navigation.projects[0].artworkEnd, 1320);
    equal(navigation.projects[1].artworkStart, 1320);
    equal(navigation.projects[1].artworkEnd, 2200);
});

test("project spans exceeding available units disable navigation", () => {
    const navigation = createProjectNavigation({
        source: "Too large,11",
        loadedImageCount: 1
    });
    equal(navigation.enabled, false);
    assert(navigation.error.includes("11 units"));
    assert(navigation.error.includes("10 artwork units"));
});

test("current project capacity follows the image manifest", async () => {
    const [projectsResponse, imagesResponse] = await Promise.all([
        fetch("../public/projects.txt"),
        fetch("../public/images.txt")
    ]);
    const loadedImageCount = imageFilenamesFromManifest(
        await imagesResponse.text()
    ).length;
    const navigation = createProjectNavigation({
        source: await projectsResponse.text(),
        loadedImageCount
    });
    equal(navigation.enabled, true);
    equal(
        navigation.totalUnits,
        loadedImageCount * artworkLayout.repetitionsPerImage
    );
    equal(
        navigation.unusedUnits,
        navigation.totalUnits - navigation.projectSpanUnits
    );
});

await run();

function equal(actual, expected) {
    assert(actual === expected, `Expected ${actual} to equal ${expected}`);
}

function assert(condition, message = "Assertion failed") {
    if (!condition) {
        throw new Error(message);
    }
}

function throws(body) {
    let threw = false;
    try {
        body();
    } catch {
        threw = true;
    }
    assert(threw, "Expected function to throw");
}

function test(name, body) {
    tests.push({ name, body });
}

async function run() {
    const failures = [];

    for (const testCase of tests) {
        try {
            await testCase.body();
        } catch (error) {
            failures.push(`${testCase.name}: ${error.message}`);
        }
    }

    const summary = failures.length === 0
        ? `PASS ${tests.length}/${tests.length}`
        : `FAIL ${tests.length - failures.length}/${tests.length}\n`
            + failures.join("\n");
    document.getElementById("results").textContent = summary;
    document.title = summary.split("\n")[0];
    console.log(summary);
}
