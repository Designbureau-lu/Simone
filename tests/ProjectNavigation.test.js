import { createProjectNavigation } from "../src/navigation/ProjectNavigation.js";
import { projectCatalogFromTsv } from "../src/projects/ProjectCatalog.js";

const tests = [];

test("navigation uses validated ProjectCatalog records unchanged", () => {
    const catalog = catalogFor([
        "Wide\t2001,2003\t3\t1",
        "Narrow\t1998\t1\t2"
    ]);
    const navigation = createProjectNavigation(catalog);

    equal(navigation.projects, catalog.projects);
    equal(navigation.logicalWidth, 2000);
    equal(navigation.projects[0].sourceStart, 0);
    equal(navigation.projects[0].sourceEnd, 1500);
    equal(navigation.projects[1].sourceStart, 1500);
    equal(navigation.projects[1].sourceEnd, 2000);
});

test("page order controls Index order while page gaps add no width", () => {
    const navigation = createProjectNavigation(catalogFor([
        "Third\t2003\t2\t8",
        "First\t2001\t1\t1",
        "Second\t2002\t3\t5"
    ]));

    equal(
        navigation.projects.map((project) => project.title).join(","),
        "First,Second,Third"
    );
    equal(
        navigation.projects.map((project) => project.page).join(","),
        "1,5,8"
    );
    equal(navigation.projects[0].sourceEnd, 500);
    equal(navigation.projects[1].sourceStart, 500);
    equal(navigation.projects[1].sourceEnd, 2000);
    equal(navigation.projects[2].sourceStart, 2000);
    equal(navigation.logicalWidth, 3000);
});

test("navigation preserves required title and opaque year text", () => {
    const project = createProjectNavigation(catalogFor([
        "Le grand soufflE\t1998,2001\t5\t5"
    ])).projects[0];

    equal(project.title, "Le grand soufflE");
    equal(project.year, "1998,2001");
});

test("all supported project widths remain intrinsic and contiguous", () => {
    const navigation = createProjectNavigation(catalogFor(
        Array.from({ length: 6 }, (_, index) => (
            `Width ${index + 1}\t200${index}\t${index + 1}\t${index + 1}`
        ))
    ));

    let expectedStart = 0;
    navigation.projects.forEach((project, index) => {
        equal(project.sourceStart, expectedStart);
        equal(project.logicalWidth, (index + 1) * 500);
        expectedStart += project.logicalWidth;
        equal(project.sourceEnd, expectedStart);
    });
    equal(navigation.logicalWidth, 10_500);
});

test("legacy image-capacity navigation input is not accepted", () => {
    throws(() => createProjectNavigation({
        source: "Legacy,3",
        loadedImageCount: 12
    }));
});

test("navigation rejects discontinuous intrinsic project ranges", () => {
    throws(() => createProjectNavigation({
        logicalWidth: 1000,
        projects: [{ sourceStart: 0, sourceEnd: 500, logicalWidth: 400 }]
    }));
    throws(() => createProjectNavigation({
        logicalWidth: 1000,
        projects: [
            { sourceStart: 0, sourceEnd: 500, logicalWidth: 500 },
            { sourceStart: 600, sourceEnd: 1000, logicalWidth: 400 }
        ]
    }));
});

test("real catalog drives all 38 projects and the authoritative width", async () => {
    const response = await fetch(
        "../public/SIMONE-export/SIMONE-projects.txt"
    );
    const source = await response.text();
    const catalog = projectCatalogFromTsv(
        source,
        "https://example.test/SIMONE-export/"
    );
    const navigation = createProjectNavigation(catalog);

    equal(navigation.projects.length, 38);
    equal(navigation.logicalWidth, 56_500);
    equal(navigation.projects.at(-1).sourceEnd, 56_500);
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

await run();

function catalogFor(rows) {
    return projectCatalogFromTsv(
        ["Project\tYear\tColumns\tPage", ...rows].join("\n"),
        "https://example.test/SIMONE-export/"
    );
}

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
