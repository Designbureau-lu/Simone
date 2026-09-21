import {
    artworkSegmentsFromProjectCatalog,
    projectCatalogFromTsv
} from "../src/projects/ProjectCatalog.js";
import { ImmutableArtwork } from "../src/artwork/ImmutableArtwork.js";
import { createProjectNavigation } from "../src/navigation/ProjectNavigation.js";

const tests = [];
const baseUrl = "https://example.test/simone/public/SIMONE-export/";

test("parses the exact exported columns and preserves display text", () => {
    const catalog = parse([
        "Project\tYear\tColumns\tPage",
        "Bubles\t1994,1995\t3\t3",
        "Le grand soufflE\t1996\t5\t5"
    ]);

    equal(catalog.projects[0].title, "Bubles");
    equal(catalog.projects[0].year, "1994,1995");
    equal(catalog.projects[1].title, "Le grand soufflE");
    equal(catalog.projects[1].year, "1996");
});

test("accepts UTF-8, a BOM, and CRLF without changing project text", () => {
    const catalog = projectCatalogFromTsv(
        "\uFEFFProject\tYear\tColumns\tPage\r\n"
            + "So weiß, weißer gehts nicht\t1998,2001\t4\t18\r\n",
        baseUrl
    );

    equal(catalog.projects[0].title, "So weiß, weißer gehts nicht");
    equal(catalog.projects[0].year, "1998,2001");
});

test("sorts by numeric Page and preserves intentional page gaps", () => {
    const catalog = parse([
        "Project\tYear\tColumns\tPage",
        "Third\t2003\t1\t9",
        "First\t2001\t1\t1",
        "Second\t2002\t1\t5"
    ]);

    equal(catalog.projects.map(({ page }) => page).join(","), "1,5,9");
    equal(catalog.projects.map(({ orderIndex }) => orderIndex).join(","), "0,1,2");
});

test("derives variable widths and cumulative source ranges", () => {
    const catalog = parse([
        "Project\tYear\tColumns\tPage",
        "One\t2001\t1\t1",
        "Three\t2003\t3\t2",
        "Six\t2006\t6\t3"
    ]);

    equal(catalog.projects[0].logicalWidth, 500);
    equal(catalog.projects[0].sourceStart, 0);
    equal(catalog.projects[0].sourceEnd, 500);
    equal(catalog.projects[1].logicalWidth, 1500);
    equal(catalog.projects[1].sourceStart, 500);
    equal(catalog.projects[1].sourceEnd, 2000);
    equal(catalog.projects[2].logicalWidth, 3000);
    equal(catalog.projects[2].sourceStart, 2000);
    equal(catalog.projects[2].sourceEnd, 5000);
    equal(catalog.logicalWidth, 5000);
    equal(catalog.logicalHeight, 2500);
});

test("derives exact filenames from Page and Project", () => {
    const [early, late] = parse([
        "Project\tYear\tColumns\tPage",
        "Blister\t2013\t3\t1",
        "So weiß, weißer gehts nicht\t2001\t4\t18"
    ]).projects;

    equal(early.filename, "01_Blister.jpg");
    equal(late.filename, "18_So weiß, weißer gehts nicht.jpg");
});

test("uses authoritative Project text unchanged in the filename", () => {
    const project = parse([
        "Project\tYear\tColumns\tPage",
        "Jagdschlößchen\t1997,2001\t4\t31"
    ]).projects[0];

    equal(project.title, "Jagdschlößchen");
    equal(project.filename, "31_Jagdschlößchen.jpg");
    equal(project.filename, `31_${project.title}.jpg`);
});

test("derives SOURCE A and B dimensions from Columns", () => {
    const project = parse([
        "Project\tYear\tColumns\tPage",
        "Variable\t2026\t5\t12"
    ]).projects[0];

    equal(project.representations.a.width, 2500);
    equal(project.representations.a.height, 2500);
    equal(project.representations.a.scale, 1);
    equal(project.representations.b.width, 1250);
    equal(project.representations.b.height, 1250);
    equal(project.representations.b.scale, 0.5);
});

test("encodes exact filenames beneath the A and B export directories", () => {
    const project = parse([
        "Project\tYear\tColumns\tPage",
        "So weiß, weißer gehts nicht\t2001\t4\t18"
    ]).projects[0];
    const encoded = "18_So%20wei%C3%9F%2C%20wei%C3%9Fer%20gehts%20nicht.jpg";

    equal(
        project.representations.a.url,
        `https://example.test/simone/public/SIMONE-export/source-a/${encoded}`
    );
    equal(
        project.representations.b.url,
        `https://example.test/simone/public/SIMONE-export/source-b/${encoded}`
    );
});

test("requires the exact header and four fields per row", () => {
    throws(() => parse(["Year\tProject\tColumns\tPage", "2001\tA\t1\t1"]));
    throws(() => parse(["Project\tYear\tColumns", "A\t2001\t1"]));
    throws(() => parse(["Project\tYear\tColumns\tPage", "A\t2001\t1"]));
    throws(() => parse(["Project\tYear\tColumns\tPage", "A\t2001\t1\t1\textra"]));
});

test("requires non-empty Project and Year fields", () => {
    throws(() => parse(["Project\tYear\tColumns\tPage", "\t2001\t1\t1"]));
    throws(() => parse(["Project\tYear\tColumns\tPage", "A\t\t1\t1"]));
    throws(() => parse(["Project\tYear\tColumns\tPage", "\t\t1\t1"]));
});

test("rejects surrounding Project or Year whitespace without normalizing", () => {
    throws(() => parse(["Project\tYear\tColumns\tPage", " A\t2001\t1\t1"]));
    throws(() => parse(["Project\tYear\tColumns\tPage", "A\t2001 \t1\t1"]));
});

test("requires Columns to be an integer from one through six", () => {
    for (const value of ["0", "7", "1.5", "-1", " 2", "2 "]) {
        throws(() => parse([
            "Project\tYear\tColumns\tPage",
            `A\t2001\t${value}\t1`
        ]));
    }
});

test("requires unique positive integer pages", () => {
    for (const value of ["0", "-1", "1.5", " 2", "2 "]) {
        throws(() => parse([
            "Project\tYear\tColumns\tPage",
            `A\t2001\t1\t${value}`
        ]));
    }
    throws(() => parse([
        "Project\tYear\tColumns\tPage",
        "A\t2001\t1\t2",
        "B\t2002\t1\t2"
    ]));
});

test("requires at least one exported project", () => {
    throws(() => parse(["Project\tYear\tColumns\tPage"]));
});

test("returns an immutable catalog and immutable nested records", () => {
    const catalog = parse([
        "Project\tYear\tColumns\tPage",
        "A\t2001\t1\t1"
    ]);

    assert(Object.isFrozen(catalog));
    assert(Object.isFrozen(catalog.projects));
    assert(Object.isFrozen(catalog.projects[0]));
    assert(Object.isFrozen(catalog.projects[0].representations));
    assert(Object.isFrozen(catalog.projects[0].representations.a));
});

test("adapts variable projects to SOURCE A and B artwork metadata", () => {
    const catalog = parse([
        "Project\tYear\tColumns\tPage",
        "One\t2001\t1\t1",
        "Six\t2006\t6\t2"
    ]);
    const sourceA = artworkSegmentsFromProjectCatalog(catalog, "a");
    const sourceB = artworkSegmentsFromProjectCatalog(catalog, "b");

    equal(sourceA.length, 2);
    equal(sourceA[0].width, 500);
    equal(sourceA[1].width, 3000);
    equal(sourceA[1].sourceWidth, 3000);
    equal(sourceA[1].sourceHeight, 2500);
    equal(sourceB[1].width, 3000);
    equal(sourceB[1].sourceWidth, 1500);
    equal(sourceB[1].sourceHeight, 1250);
});

test("establishes identical variable intrinsic geometry for A and B", () => {
    const catalog = parse([
        "Project\tYear\tColumns\tPage",
        "One\t2001\t1\t1",
        "Three\t2003\t3\t2",
        "Six\t2006\t6\t3"
    ]);
    const artworkA = ImmutableArtwork.fromMetadata(
        artworkSegmentsFromProjectCatalog(catalog, "a")
    );
    const artworkB = ImmutableArtwork.fromMetadata(
        artworkSegmentsFromProjectCatalog(catalog, "b")
    );

    equal(artworkA.width, 5000);
    equal(artworkB.width, artworkA.width);
    equal(artworkA.height, 2500);
    equal(artworkB.height, artworkA.height);
    equal(
        artworkA.segmentDescriptors().map(({ sourceStart }) => sourceStart)
            .join(","),
        "0,500,2000"
    );
    equal(
        artworkB.segmentDescriptors().map(({ sourceStart }) => sourceStart)
            .join(","),
        "0,500,2000"
    );
    equal(artworkA.sourceRepresentation.rasterScale, 1);
    equal(artworkB.sourceRepresentation.rasterScale, 0.5);
    equal(artworkA.sourceRepresentation.label, "SOURCE A");
    equal(artworkB.sourceRepresentation.label, "SOURCE B");
});

test("SOURCE A and B share the same catalog navigation geometry", () => {
    const catalog = parse([
        "Project\tYear\tColumns\tPage",
        "One\t2001\t1\t1",
        "Three\t2003\t3\t4"
    ]);
    const navigation = createProjectNavigation(catalog);
    const artworkA = ImmutableArtwork.fromMetadata(
        artworkSegmentsFromProjectCatalog(catalog, "a")
    );
    const artworkB = ImmutableArtwork.fromMetadata(
        artworkSegmentsFromProjectCatalog(catalog, "b")
    );

    equal(artworkA.width, navigation.logicalWidth);
    equal(artworkB.width, navigation.logicalWidth);
    equal(navigation.projects[0].sourceStart, 0);
    equal(navigation.projects[0].sourceEnd, 500);
    equal(navigation.projects[1].sourceStart, 500);
    equal(navigation.projects[1].sourceEnd, 2000);
});

test("real catalog creates 38 variable segments across 56500 units", async () => {
    const response = await fetch(
        "../public/SIMONE-export/SIMONE-projects.txt"
    );
    assert(response.ok);
    const catalog = projectCatalogFromTsv(
        await response.text(),
        new URL("../public/SIMONE-export/", window.location.href)
    );
    const artworkA = ImmutableArtwork.fromMetadata(
        artworkSegmentsFromProjectCatalog(catalog, "a")
    );
    const artworkB = ImmutableArtwork.fromMetadata(
        artworkSegmentsFromProjectCatalog(catalog, "b")
    );

    equal(catalog.projects.length, 38);
    equal(catalog.logicalWidth, 56500);
    equal(artworkA.imageCount, 38);
    equal(artworkB.imageCount, 38);
    equal(artworkA.width, 56500);
    equal(artworkB.width, 56500);
});

await run();

function parse(lines) {
    return projectCatalogFromTsv(lines.join("\n"), baseUrl);
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
