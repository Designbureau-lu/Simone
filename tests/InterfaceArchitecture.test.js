import {
    bindDebugPanel,
    bindConversationInterface,
    createTitleTransition
} from "../src/application/startSimone.js";

const tests = [];

test("public markup no longer contains the floating cartel flow", async () => {
    const source = await fetch("../index.html").then((response) => (
        response.text()
    ));

    assert(!source.includes("projectInformation"));
    assert(!source.includes("Lorem ipsum"));
    assert(!source.includes("Read more"));
});

test("normal page starts with Dev visible and its panel hidden", async () => {
    const source = await fetch("../index.html").then((response) => (
        response.text()
    ));
    const page = new DOMParser().parseFromString(source, "text/html");

    assert(page.getElementById("debugPanel").hidden);
    assert(!page.getElementById("debugReopen").hidden);
});

test("debug controls expose the canonical renderer defaults", async () => {
    const source = await fetch("../index.html").then((response) => (
        response.text()
    ));
    const page = new DOMParser().parseFromString(source, "text/html");

    equal(page.getElementById("minimumVisibleFactorNumber").value, "20");
    equal(page.getElementById("maximumVisibleFactorNumber").value, "100");
    equal(page.getElementById("resetCurtainStateNumber").value, "50");
    equal(page.getElementById("carrierDistanceNumber").value, "120");
    equal(page.getElementById("modelTransitionNumber").value, "50");
});

test("debug panel is ordered, titleless, and excludes temporary navigation", async () => {
    const source = await fetch("../index.html").then((response) => (
        response.text()
    ));
    const page = new DOMParser().parseFromString(source, "text/html");
    const panel = page.getElementById("debugPanel");
    const text = Array.from(panel.querySelectorAll(
        ".debug-control label,.developer-viewport-control label,"
        + ".performance-overview-header span"
    )).map((element) => element.textContent.trim());

    equal(text.join("|"), [
        "Minimum Visible Factor",
        "Maximum Visible Factor",
        "Reset Curtain State",
        "Carrier Distance",
        "Model Transition",
        "Viewport Position",
        "Performance"
    ].join("|"));
    assert(!panel.querySelector("h1,h2,h3,h4,h5,h6"));
    assert(!panel.querySelector("[data-project-next]"));
    assert(!panel.querySelector("[data-debug-reset]"));
    assert(!panel.querySelector("[data-performance-toggle]"));
    assert(!panel.querySelector("[data-performance-body]").hidden);
    equal(page.getElementById("debugReopen").textContent.trim(), "Dev");
    assert(page.getElementById("semanticNavigation").hidden);
});

test("debug panel closes to a small reopen control and restores focus", () => {
    const panel = document.createElement("aside");
    panel.className = "debug-panel";
    panel.hidden = true;
    panel.innerHTML = `
        <button type="button" data-debug-close>×</button>
    `;
    const reopen = document.createElement("button");
    reopen.className = "debug-reopen";
    document.body.append(panel, reopen);
    bindDebugPanel(panel, reopen);

    assert(getComputedStyle(reopen).display !== "none");
    reopen.click();
    assert(!panel.hidden);
    assert(reopen.hidden);
    equal(getComputedStyle(reopen).display, "none");
    panel.querySelector("[data-debug-close]").click();
    assert(panel.hidden);
    assert(!reopen.hidden);
    equal(getComputedStyle(panel).display, "none");
    assert(getComputedStyle(reopen).display !== "none");
    equal(document.activeElement, reopen);
    reopen.click();
    assert(!panel.hidden);
    assert(reopen.hidden);
    assert(getComputedStyle(panel).display !== "none");
    equal(getComputedStyle(reopen).display, "none");
    equal(document.activeElement, panel.querySelector("[data-debug-close]"));
    panel.remove();
    reopen.remove();
});

test("conversation title follows default, Explore, project, and inactive states", () => {
    const fixture = createFixture();
    const controller = bindConversationInterface(
        fixture.bar,
        fixture.application,
        () => {},
        () => {}
    );

    equal(controller.title, "LETZEBUERGER KONSCHTPRAIS");
    controller.showDragHint();
    equal(controller.title, "LETZEBUERGER KONSCHTPRAIS");
    controller.markDragLearned();
    equal(controller.title, "Simone Decker");
    controller.showProject(fixture.projects[2]);
    equal(controller.title, "Airbag");
    controller.showDragHint();
    equal(controller.title, "Airbag");
    controller.markDragLearned();
    equal(controller.title, "Simone Decker");
    controller.markExplorationInactive();
    equal(controller.title, "LETZEBUERGER KONSCHTPRAIS");
});

test("title transitions keep header height and reduced motion replaces immediately", () => {
    const fixture = createFixture();
    const controller = bindConversationInterface(
        fixture.bar,
        fixture.application,
        () => {},
        () => {}
    );
    const initialHeight = getComputedStyle(fixture.bar).height;
    controller.markDragLearned();
    equal(getComputedStyle(fixture.bar).height, initialHeight);

    const output = document.createElement("output");
    output.setAttribute("aria-label", "LETZEBUERGER KONSCHTPRAIS");
    const transition = createTitleTransition(output, {
        reducedMotion: true
    });
    transition.set("Simone Decker");
    equal(output.children.length, 1);
    equal(output.textContent, "Simone Decker");
    assert(!output.firstElementChild.classList.contains("is-incoming"));
});

test("mobile and desktop title controllers use identical semantic states", () => {
    const mobile = createFixture();
    const desktop = createFixture();
    const controllers = [mobile, desktop].map((fixture) => (
        bindConversationInterface(
            fixture.bar,
            fixture.application,
            () => {},
            () => {}
        )
    ));

    controllers.forEach((controller) => controller.markDragLearned());
    equal(controllers[0].title, controllers[1].title);
    controllers.forEach((controller) => controller.showProject(
        mobile.projects[1]
    ));
    equal(controllers[0].title, controllers[1].title);
});

test("menu has no visible heading, highlights active project, and closes", () => {
    const fixture = createFixture();
    bindConversationInterface(
        fixture.bar,
        fixture.application,
        () => {},
        () => {}
    );

    fixture.trigger.click();
    equal(fixture.trigger.textContent, "×");
    equal(fixture.trigger.getAttribute("aria-expanded"), "true");
    assert(!fixture.panel.hidden);
    assert(!fixture.panel.querySelector("h1,h2,h3,h4,h5,h6"));
    equal(
        fixture.list.querySelector(
            '[aria-current="true"] .conversation-project-title'
        ).textContent,
        "Bubles"
    );
    equal(
        fixture.list.querySelector(
            '[aria-current="true"] .conversation-project-year'
        ).textContent,
        "2024"
    );
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    assert(fixture.panel.hidden);
    equal(fixture.trigger.textContent, "☰");
    equal(document.activeElement, fixture.trigger);
});

test("menu project selection uses the existing READ entry pipeline", () => {
    const fixture = createFixture();
    const controller = bindConversationInterface(
        fixture.bar,
        fixture.application,
        fixture.synchronizeViewport,
        fixture.synchronizeNavigation
    );

    fixture.trigger.click();
    fixture.list.querySelectorAll("button")[2].click();
    equal(fixture.selections.length, 1);
    equal(fixture.selections[0].index, 2);
    equal(
        fixture.selections[0].onFrame,
        fixture.synchronizeViewport
    );
    equal(controller.title, "Airbag");
    assert(fixture.panel.hidden);
});

function createFixture() {
    const bar = document.createElement("header");
    bar.className = "conversation-bar";
    bar.innerHTML = `
        <output class="conversation-bar-text" data-conversation-text
            aria-label="LETZEBUERGER KONSCHTPRAIS">
            <span class="conversation-title-line"
                data-conversation-title-line>LETZEBUERGER KONSCHTPRAIS</span>
        </output>
        <button class="conversation-menu-trigger" type="button"
            data-conversation-menu-trigger>☰</button>
        <nav class="conversation-project-list" hidden>
            <ul data-conversation-projects></ul>
        </nav>
    `;
    document.body.append(bar);
    const projects = [
        { title: "Blister", year: "2023" },
        { title: "Bubles", year: "2024" },
        { title: "Airbag", year: null }
    ];
    const selections = [];
    const application = {
        attentionMode: "read",
        currentProjectIndex: 1,
        projectNavigation: { enabled: true, projects },
        resetAndNavigateToProject(index, onFrame, onSelection) {
            selections.push({ index, onFrame });
            this.currentProjectIndex = index;
            onSelection();
            return true;
        }
    };
    const synchronizeViewport = () => {};
    const synchronizeNavigation = () => {};

    return {
        bar,
        output: bar.querySelector("output"),
        trigger: bar.querySelector("[data-conversation-menu-trigger]"),
        panel: bar.querySelector("nav"),
        list: bar.querySelector("ul"),
        projects,
        selections,
        application,
        synchronizeViewport,
        synchronizeNavigation
    };
}

function equal(actual, expected) {
    assert(actual === expected, `Expected ${actual} to equal ${expected}`);
}

function assert(condition, message = "Assertion failed") {
    if (!condition) {
        throw new Error(message);
    }
}

function test(name, body) {
    tests.push({ name, body });
}

await run();

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
