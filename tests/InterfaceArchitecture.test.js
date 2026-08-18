import {
    artworkRepresentationUrlWithoutOverride,
    bindDebugPanel,
    bindMobileSnapBoxDiagnostic,
    bindConversationInterface,
    createTitleTransition,
    selectedArtworkRepresentationId
} from "../src/application/startSimone.js";
import {
    CurtainEntranceMotion
} from "../src/prototypes/arrival/CurtainEntranceMotion.js";
import {
    CURTAIN_ENTRANCE_CONFIG,
    curtainSettlementIsReady,
    revealIndexLabel,
    restoreCurtainSnapshot,
    settlementDurationForRange,
    staggeredPeriodProgress,
    visiblePeriodRangeFor
} from "../src/prototypes/arrival/startCurtainEntrance.js";
import {
    createIdentityBlobPresentation,
    IDENTITY_BLOB_CONFIG,
    mobileUpwardScrollSeparation
} from "../src/prototypes/identity/startIdentityBlobPresentation.js";

const tests = [];

test("human scroll directly controls the pre-snap curtain position", () => {
    const motion = createEntranceMotion();
    motion.updateScrollProgress(0.75);

    equal(motion.currentOffset, motion.targetOffset);
    assert(motion.currentOffset < motion.initialOffset);
    assert(motion.currentOffset > motion.offsetRemainingAtSnap);
});

test("curtain entrance retains a short four-percent onset dead zone", () => {
    const motion = createEntranceMotion();
    equal(CURTAIN_ENTRANCE_CONFIG.delayProgress, 0.04);
    motion.updateScrollProgress(0.03);
    equal(motion.currentOffset, motion.initialOffset);
    motion.updateScrollProgress(0.05);
    assert(motion.currentOffset < motion.initialOffset);
});

test("entrance controller does not depend on Scroll Snap Events", async () => {
    const source = await fetch(
        "../src/prototypes/arrival/startCurtainEntrance.js"
    ).then((response) => response.text());
    assert(!source.includes("scrollsnapchanging"));
    assert(!source.includes("scrollsnapchange"));
});

test("curtain entrance overflow is contained without clipping page scroll", async () => {
    const source = await fetch("../style.css").then((response) => (
        response.text()
    ));
    assert(/\.hero\s*>\s*\.container\s*\{[^}]*overflow-x:clip;/s.test(
        source
    ));
    assert(!/html\s*,\s*body\s*\{[^}]*overflow\s*:\s*hidden/s.test(source));
});

test("desktop Screen 1 alone uses an always-stop snap target", async () => {
    const source = await fetch("../style.css").then((response) => (
        response.text()
    ));
    assert(/\.arrival-screen-identity\s*\{[^}]*scroll-snap-stop:always;/s.test(
        source
    ));
    assert(/\.arrival-screen,\s*\.curtain-sticky-stage\s*\{[^}]*scroll-snap-stop:normal;/s.test(
        source
    ));
});

test("mobile Screen 1 is 100dvh ordinary flow and the 100dvh curtain is the sole intro snap target", async () => {
    const style = await fetch("../style.css").then((response) => response.text());
    const blobSource = await fetch(
        "../src/prototypes/identity/startIdentityBlobPresentation.js"
    ).then((response) => response.text());
    const entranceSource = await fetch(
        "../src/prototypes/arrival/startCurtainEntrance.js"
    ).then((response) => response.text());

    assert(/@media \(max-width:767px\)\s*\{[\s\S]*?\.arrival-screen-identity\s*\{[^}]*display:block;[^}]*height:100dvh;/s.test(
        style
    ));
    assert(/@media \(max-width:767px\)\s*\{[\s\S]*?\.curtain-sticky-stage,\s*\.curtain-sticky-stage > \.hero\s*\{[^}]*height:100vh;[^}]*height:100dvh;/s.test(
        style
    ));
    assert(!/\.curtain-sticky-stage\s*\{[^}]*margin-bottom:120px;/s.test(style));
    assert(/@media \(max-width:767px\)\s*\{[\s\S]*?html\s*\{[^}]*scroll-snap-type:y proximity;/s.test(style));
    assert(/\.arrival-screen-identity\s*\{\s*scroll-snap-align:none;\s*\}/s.test(style));
    assert(/@media \(max-width:767px\)\s*\{[\s\S]*?\.curtain-sticky-stage\s*\{[^}]*scroll-snap-align:start;[^}]*scroll-snap-stop:always;/s.test(style));
    assert(/animation:identity-blob-breathe 10s/.test(style));
    assert(/@media \(max-width:767px\)\s*\{[\s\S]*?\.arrival-identity-title\s*\{[^}]*display:grid;[^}]*grid-template-columns:max-content max-content;[^}]*align-items:center;[^}]*column-gap:0\.8ch;/s.test(
        style
    ));
    assert(/font-size:calc\(\(100vw - 48px\) \/ 8\.28\);/.test(style));
    assert(/@media \(max-width:767px\)\s*\{[\s\S]*?\.arrival-identity-blob\s*\{[^}]*left:var\(--blob-center-x,72vw\);[^}]*width:96vw;/s.test(
        style
    ));
    assert(/mobile: Object\.freeze\(/.test(blobSource));
    assert(!/if \(!window\.matchMedia\(DESKTOP_QUERY\)\.matches\)/.test(blobSource));
    assert(!/const DESKTOP_QUERY/.test(entranceSource));
    assert(/window\.addEventListener\("scroll", updateScrollTarget/.test(entranceSource));
    assert(/presentation\.dataset\.entranceActive/.test(entranceSource));
});

test("mobile snap-box diagnostic is off by default and reports real boxes", async () => {
    const source = await fetch("../index.html").then((response) => (
        response.text()
    ));
    const page = new DOMParser().parseFromString(source, "text/html");
    const sourceToggle = page.getElementById("mobileSnapBoxToggle");
    assert(!sourceToggle.checked);

    const screenOne = document.createElement("section");
    screenOne.className = "arrival-screen-identity";
    const screenTwo = document.createElement("section");
    screenTwo.className = "curtain-sticky-stage";
    const editorial = document.createElement("article");
    editorial.className = "exhibition-information";
    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    const output = document.createElement("pre");
    document.body.append(screenOne, screenTwo, editorial, toggle, output);

    const diagnostic = bindMobileSnapBoxDiagnostic(toggle, output);
    assert(!toggle.checked);
    assert(output.hidden);
    assert(!document.body.hasAttribute("data-show-mobile-snap-boxes"));
    toggle.checked = true;
    diagnostic.update();
    assert(output.textContent.includes("window.innerHeight"));
    assert(output.textContent.includes("visualViewport.height"));
    assert(output.textContent.includes("SCREEN 1 · 100dvh · NO SNAP height"));
    assert(!output.textContent.includes("SCREEN 1 · 100dvh · NO SNAP snap-start"));
    assert(output.textContent.includes("SCREEN 2 · 100dvh · SNAP START height"));
    assert(output.textContent.includes("SCREEN 2 · 100dvh · SNAP START snap-start"));
    assert(output.textContent.includes("EDITORIAL top"));

    screenOne.remove();
    screenTwo.remove();
    editorial.remove();
    toggle.remove();
    output.remove();
});

test("mobile curtain header presents INDEX without the conversation title", async () => {
    const style = await fetch("../style.css").then((response) => response.text());

    assert(/@media \(max-width:767px\)\s*\{[\s\S]*?#conversationBar > \.curtain-index-label\s*\{[^}]*display:block;[^}]*font:400 var\(--type-information\)\/1\.2 "Söhne Mono Buch",monospace;/s.test(
        style
    ));
    assert(/@media \(max-width:767px\)\s*\{[\s\S]*?#conversationBar > \.conversation-bar-text\s*\{[^}]*display:none;/s.test(
        style
    ));
});

test("identity typography and surrounding information use shared authoritative rules", async () => {
    const style = await fetch("../style.css").then((response) => response.text());

    assert(/\.arrival-identity-artist\s*\{[^}]*font-family:"Söhne Mono Buch",monospace;[^}]*font-weight:400;/s.test(
        style
    ));
    assert(/\.arrival-identity-prize,\s*\.arrival-identity-prize-letters\s*\{[^}]*font-family:"Söhne Mono Extraleicht",monospace;[^}]*font-weight:200;/s.test(
        style
    ));
    assert(/\.arrival-identity-prize-digits\s*\{[^}]*font-family:"Söhne Mono Buch",monospace;[^}]*font-weight:400;/s.test(
        style
    ));
    assert(/\.arrival-identity-content\s*\{[^}]*grid-template-rows:minmax\(0,1fr\) auto minmax\(0,1fr\);/s.test(
        style
    ));
    assert(/\.arrival-identity-dates\s*\{[^}]*grid-row:1;[^}]*align-self:center;/s.test(
        style
    ));
    assert(/\.arrival-identity-title\s*\{[^}]*grid-row:2;[^}]*align-self:center;/s.test(
        style
    ));
    assert(/\.arrival-identity-venue\s*\{[^}]*grid-row:3;[^}]*align-self:center;/s.test(
        style
    ));
});

test("identity prize assigns Buch only to the 20 and 26 spans", async () => {
    const source = await fetch("../index.html").then((response) => response.text());
    const page = new DOMParser().parseFromString(source, "text/html");
    const prize = page.querySelector(".arrival-identity-prize");
    const pieces = Array.from(prize.querySelectorAll(":scope > span"));

    equal(pieces[0].querySelector(".arrival-identity-prize-letters")?.textContent, "LETZE");
    equal(pieces[0].querySelector("strong")?.textContent, "20");
    equal(pieces[1].textContent, "BUERGER");
    equal(pieces[2].textContent, "KONSCHT");
    equal(pieces[3].querySelector(".arrival-identity-prize-letters")?.textContent, "PRAIS");
    equal(pieces[3].querySelector("strong")?.textContent, "26");

    const livePrize = prize.cloneNode(true);
    document.body.append(livePrize);
    const letterSpans = Array.from(livePrize.querySelectorAll(
        ".arrival-identity-prize-letters"
    ));
    const digitSpans = Array.from(livePrize.querySelectorAll(
        ".arrival-identity-prize-digits"
    ));
    for (const letters of letterSpans) {
        equal(getComputedStyle(letters).fontFamily,
            '"Söhne Mono Extraleicht", monospace');
        equal(getComputedStyle(letters).fontWeight, "200");
    }
    for (const digits of digitSpans) {
        equal(getComputedStyle(digits).fontFamily,
            '"Söhne Mono Buch", monospace');
        equal(getComputedStyle(digits).fontWeight, "400");
    }
    livePrize.remove();
});

test("mobile title fits one intrinsic composition between symmetric margins", async () => {
    const style = await fetch("../style.css").then((response) => response.text());

    assert(/@media \(max-width:767px\)\s*\{[\s\S]*?\.arrival-identity-content\s*\{[^}]*padding-inline:24px;/s.test(
        style
    ));
    assert(/@media \(max-width:767px\)\s*\{[\s\S]*?\.arrival-identity-language\s*\{[^}]*left:24px;/s.test(
        style
    ));
    assert(/@media \(max-width:767px\)\s*\{[\s\S]*?\.arrival-identity-title\s*\{[^}]*position:absolute;[^}]*top:50%;[^}]*left:50%;[^}]*display:grid;[^}]*grid-template-columns:max-content max-content;[^}]*column-gap:0\.8ch;[^}]*width:max-content;[^}]*transform:translate\(-50%,-50%\);[^}]*font-size:calc\(\(100vw - 48px\) \/ 8\.28\);/s.test(
        style
    ));
    assert(!/@media \(max-width:767px\)[\s\S]*?\.arrival-identity-title\s*\{[^}]*justify-content:space-between;/s.test(
        style
    ));
});

test("mobile identity text is a normal-scroll layer separate from blob parallax", async () => {
    const source = await fetch("../index.html").then((response) => response.text());
    const page = new DOMParser().parseFromString(source, "text/html");
    const screen = page.querySelector(".arrival-screen-identity");
    const content = screen.querySelector(":scope > .arrival-identity-content");
    const blob = screen.querySelector(":scope > .arrival-identity-blob");

    assert(content);
    assert(blob);
    assert(content.querySelector(".arrival-identity-language"));
    assert(content.querySelector(".arrival-identity-dates"));
    assert(content.querySelector(".arrival-identity-title"));
    assert(content.querySelector(".arrival-identity-venue"));
    equal(blob.contains(content), false);
    equal(content.contains(blob), false);
});

test("INDEX reveal keeps the approved post-landing beat", () => {
    equal(CURTAIN_ENTRANCE_CONFIG.indexRevealDelay, 200);
    equal(CURTAIN_ENTRANCE_CONFIG.indexCharacterInterval, 10);
});

test("INDEX fixed cells become visible and readable after reveal", async () => {
    const bar = document.createElement("header");
    bar.id = "conversationBar";
    bar.className = "conversation-bar";
    const label = document.createElement("span");
    label.className = "curtain-index-label";
    bar.append(label);
    document.body.append(bar);

    revealIndexLabel(label);
    await new Promise((resolve) => window.setTimeout(resolve, 180));

    const cells = Array.from(label.querySelectorAll(".character-cell"));
    const style = getComputedStyle(label);
    equal(cells.length, 5);
    equal(cells.map((cell) => cell.textContent).join(""), "INDEX");
    equal(style.opacity, "1");
    equal(style.visibility, "visible");
    equal(style.color, "rgb(60, 60, 60)");
    equal(
        style.transform,
        window.matchMedia("(min-width: 768px)").matches
            ? "matrix(1, 0, 0, 1, 0, 12)"
            : "none"
    );
    equal(style.display, "block");

    const barStyle = getComputedStyle(bar);
    if (window.matchMedia("(max-width: 767px)").matches) {
        equal(barStyle.height, "75px");
    }

    bar.remove();
});

test("continued pre-snap scroll never leaves curtain on a waiting plateau", () => {
    const motion = createEntranceMotion();
    motion.updateScrollProgress(0.8);
    const early = motion.currentOffset;
    motion.updateScrollProgress(0.9);
    const later = motion.currentOffset;
    motion.updateScrollProgress(0.99);

    assert(later < early);
    assert(motion.currentOffset < later);
    assert(motion.currentOffset > motion.offsetRemainingAtSnap);
});

test("native snap begins without resetting curtain position", () => {
    const motion = createEntranceMotion();
    motion.updateScrollProgress(0.99);
    const positionAtSnap = motion.currentOffset;

    motion.beginNativeSnap();

    equal(motion.currentOffset, positionAtSnap);
    equal(motion.snapStartOffset, positionAtSnap);
});

test("native snap triggers an independent finite curtain flight", () => {
    const motion = createEntranceMotion();
    motion.updateScrollProgress(0.99);
    motion.beginNativeSnap();
    const snapStart = motion.currentOffset;

    motion.advance(CURTAIN_ENTRANCE_CONFIG.snapFlightDuration / 2);
    approximatelyEqual(motion.currentOffset, snapStart * 0.5);
    assert(!motion.complete);
    motion.advance(CURTAIN_ENTRANCE_CONFIG.snapFlightDuration / 2);

    equal(motion.currentOffset, 0);
    assert(motion.complete);
    equal(motion.snapFlightElapsed, 280);
});

test("snap-following curtain ignores later ordinary scroll targets", () => {
    const motion = createEntranceMotion();
    motion.updateScrollProgress(0.9);
    motion.beginNativeSnap();
    const capturedPosition = motion.currentOffset;

    motion.updateScrollProgress(0.25);

    equal(motion.currentOffset, capturedPosition);
});

test("condensation starts on the horizontal impact frame", () => {
    const snapshot = { visibleFactors: [0.4], sceneVisibleFactor: 0.4 };
    assert(!curtainSettlementIsReady({
        horizontalJustCompleted: false,
        curtainSnapshot: snapshot
    }));
    assert(curtainSettlementIsReady({
        horizontalJustCompleted: true,
        curtainSnapshot: snapshot
    }));
});

test("curtain entrance restores the captured state exactly", () => {
    const appliedFactors = [];
    const application = {
        curtainField: {
            setVisibleFactors(visibleFactors) {
                appliedFactors.push(visibleFactors);
            }
        },
        sceneVisibleFactor: 0.85,
        renderCount: 0,
        render() {
            this.renderCount += 1;
        }
    };
    const snapshot = {
        visibleFactors: Object.freeze([0.2, 0.375, 0.9]),
        sceneVisibleFactor: 0.375
    };

    restoreCurtainSnapshot(application, snapshot);

    equal(appliedFactors[0].join(","), snapshot.visibleFactors.join(","));
    assert(appliedFactors[0] !== snapshot.visibleFactors);
    equal(application.sceneVisibleFactor, snapshot.sceneVisibleFactor);
    equal(application.renderCount, 1);
});

test("settlement staggers visible Periods in physical left-to-right order", () => {
    const visibleRange = { first: 4, last: 7 };
    const options = {
        elapsed: 24,
        visibleRange,
        stagger: CURTAIN_ENTRANCE_CONFIG.periodSettlementStagger,
        duration: CURTAIN_ENTRANCE_CONFIG.settlementDuration
    };
    equal(options.stagger, 12);
    equal(options.duration, 600);
    const progress = [4, 5, 6, 7].map((periodIndex) => (
        staggeredPeriodProgress({ ...options, periodIndex })
    ));
    assert(progress[0] > progress[1]);
    assert(progress[1] > progress[2]);
    equal(progress[2], 0);
    equal(progress[3], 0);
});

test("settlement captures one fixed visible Period range", () => {
    const columns = [
        projectedColumn(0, -10),
        projectedColumn(1, 10),
        undefined,
        projectedColumn(2, 30),
        projectedColumn(3, 50)
    ];
    const application = {
        curtainField: { periods: [{}, {}, {}, {}] },
        projectedColumns: columns,
        viewport: {
            projectedOffset: 10,
            projectedExtent: 30
        }
    };
    const capturedRange = visiblePeriodRangeFor(application);
    application.viewport.projectedOffset = 30;

    equal(capturedRange.first, 1);
    equal(capturedRange.last, 2);
});

test("offscreen Period settlement clamps to visible edge timing", () => {
    const options = {
        elapsed: 120,
        visibleRange: { first: 4, last: 7 },
        stagger: 12,
        duration: 600
    };
    equal(
        staggeredPeriodProgress({ ...options, periodIndex: 0 }),
        staggeredPeriodProgress({ ...options, periodIndex: 4 })
    );
    equal(
        staggeredPeriodProgress({ ...options, periodIndex: 12 }),
        staggeredPeriodProgress({ ...options, periodIndex: 7 })
    );
    equal(settlementDurationForRange(options.visibleRange, 600, 12), 636);
});

test("completed entrance restoration cannot overwrite later interaction", () => {
    const application = {
        curtainField: {
            factors: [],
            setVisibleFactors(factors) {
                this.factors = factors.slice();
            }
        },
        sceneVisibleFactor: 0.85,
        render() {}
    };
    const snapshot = {
        visibleFactors: Object.freeze([0.3, 0.6]),
        sceneVisibleFactor: 0.3
    };
    restoreCurtainSnapshot(application, snapshot);
    application.curtainField.factors[0] = 0.72;

    equal(application.curtainField.factors[0], 0.72);
    equal(snapshot.visibleFactors[0], 0.3);
});

test("public markup no longer contains the floating cartel flow", async () => {
    const source = await fetch("../index.html").then((response) => (
        response.text()
    ));

    assert(!source.includes("projectInformation"));
    assert(!source.includes("Read more"));
});

test("lower information is semantic live HTML with section-owned actions", async () => {
    const source = await fetch("../index.html").then((response) => (
        response.text()
    ));
    const page = new DOMParser().parseFromString(source, "text/html");
    const information = page.querySelector(".exhibition-information");
    const editorialSections = information.querySelectorAll(
        ":scope > .editorial-section"
    );

    assert(information);
    assert(!page.querySelector(".arrival-screen-content"));
    equal(editorialSections.length, 3);
    equal(
        Array.from(editorialSections).map((section) => (
            section.querySelector("h2").textContent.replace(/\s+/g, " ").trim()
        )).join("|"),
        "SIMONE DECKER|LETZEBUERGER KONSCHTPRAIS 2026|JURY STATEMENT"
    );
    equal(
        Array.from(editorialSections).map((section) => (
            section.querySelectorAll(":scope > .editorial-actions .information-pill")
                .length
        )).join("|"),
        "2|1|1"
    );
    equal(information.querySelectorAll(".visit-information-block").length, 2);
    assert(information.querySelector(".exhibition-footer-logos[src='assets/logos.svg']"));
    equal(information.querySelectorAll(".information-pill").length, 5);
    equal(information.querySelectorAll("h2 img,h2 svg").length, 0);
    equal(
        Array.from(editorialSections).map((section) => (
            Array.from(section.querySelectorAll(".editorial-title-line"))
                .map((line) => line.textContent.trim()).join("/")
        )).join("|"),
        "SIMONE/DECKER|LETZEBUERGER/KONSCHTPRAIS/2026|JURY/STATEMENT"
    );
});

test("lower information uses the shared type system and constrained body copy", async () => {
    const source = await fetch("../style.css").then((response) => (
        response.text()
    ));

    assert(/font-family:"Noi Grotesk Light";[^}]*NoiGrotesk-Light\.woff2[^}]*font-weight:300;/s.test(
        source
    ));
    assert(/--type-section:clamp\(2\.5rem,3\.2vw,4rem\);/.test(source));
    assert(/--type-body:1rem;/.test(source));
    assert(/@media \(min-width:768px\)\s*\{\s*:root\s*\{[^}]*--type-body:1\.5rem;/s.test(
        source
    ));
    assert(/\.editorial-body\s*\{[^}]*width:min\(50vw,56rem\);[^}]*font:300 var\(--type-body\)\/1\.45 "Noi Grotesk Light",sans-serif;/s.test(
        source
    ));
    assert(/\.information-pill\s*\{[^}]*border-radius:999px;[^}]*font:400 0\.85rem\/1 "Söhne Mono Buch",monospace;/s.test(
        source
    ));
    assert(/\.visit-information-block p\s*\{[^}]*font:400 var\(--type-information\)\/1\.5 "Söhne Mono Buch",monospace;/s.test(
        source
    ));
    assert(/@media \(min-width:768px\)\s*\{[\s\S]*?\.editorial-title\s*\{[^}]*grid-area:title;[^}]*justify-self:end;[^}]*text-align:right;/s.test(
        source
    ));
});

test("desktop Screen 1 identity is live HTML rather than the reference SVG", async () => {
    const source = await fetch("../index.html").then((response) => (
        response.text()
    ));
    const page = new DOMParser().parseFromString(source, "text/html");
    const screen = page.querySelector(".arrival-screen-identity");

    assert(screen);
    assert(!screen.querySelector("svg"));
    equal(screen.querySelector("[data-identity-blob] img")?.getAttribute("src"),
        "assets/blop.svg");
    equal(screen.querySelector(".arrival-identity-language").textContent
        .replace(/\s+/g, " ").trim(), "EN FR");
    equal(screen.querySelector(".arrival-identity-artist").textContent
        .replace(/\s+/g, " ").trim(), "SIMONE DECKER");
    equal(screen.querySelector(".arrival-identity-prize").textContent
        .replace(/\s+/g, " ").trim(), "LETZE20 BUERGER KONSCHT PRAIS26");
    equal(
        Array.from(screen.querySelectorAll(".arrival-identity-prize strong"))
            .map((element) => element.textContent).join("|"),
        "20|26"
    );
    equal(screen.querySelector(".arrival-identity-dates").textContent,
        "13.11.2026 - 21.03.2027");
    equal(screen.querySelector(".arrival-identity-venue").textContent,
        "NATIONALMUSEE UM FESCHMAART");
});

test("identity blob uses stable side-biased desktop and mobile presentations", () => {
    const minimum = createIdentityBlobPresentation(() => 0);
    const maximum = createIdentityBlobPresentation(() => 1);
    const mobileMinimum = createIdentityBlobPresentation(() => 0, "mobile");
    const mobileMaximum = createIdentityBlobPresentation(() => 1, "mobile");

    equal(JSON.stringify(minimum), JSON.stringify({
        horizontalSide: "left",
        centerX: 28,
        centerY: 38,
        scaleX: 0.97,
        scaleY: 0.95,
        rotation: -4,
        skewX: -2
    }));
    equal(JSON.stringify(maximum), JSON.stringify({
        horizontalSide: "right",
        centerX: 72,
        centerY: 60,
        scaleX: 1.03,
        scaleY: 1.05,
        rotation: 4,
        skewX: 2
    }));
    equal(mobileMinimum.centerX, 24);
    equal(mobileMaximum.centerX, 76);
    equal(mobileMinimum.horizontalSide, "left");
    equal(mobileMaximum.horizontalSide, "right");
    equal(IDENTITY_BLOB_CONFIG.scrollRate, 0.90);
});

test("mobile upward blob re-entry eases from the exact current pose", () => {
    const start = Object.freeze({ scrollY: 800, separation: 80 });
    equal(mobileUpwardScrollSeparation(start, 800), 80);
    equal(mobileUpwardScrollSeparation(start, 0), 0);
    assert(mobileUpwardScrollSeparation(start, 720) < 72);
});

test("desktop identity blob separates pose, breathing, and scroll transforms", async () => {
    const source = await fetch("../style.css").then((response) => (
        response.text()
    ));

    assert(/\.arrival-identity-blob\s*\{[^}]*z-index:0;[^}]*width:clamp\(360px,42vw,720px\);[^}]*--blob-scroll-separation/s.test(
        source
    ));
    assert(/\.arrival-identity-blob-pose\s*\{[^}]*rotate\(var\(--blob-rotation,0deg\)\)[^}]*skewX\(var\(--blob-skew-x,0deg\)\)[^}]*scale\(var\(--blob-scale-x,1\),var\(--blob-scale-y,1\)\)/s.test(
        source
    ));
    assert(/animation:identity-blob-breathe 10s[^;]*infinite;/s.test(
        source
    ));
    assert(/0%\s*\{[^}]*translate\(-7px,0\) scale\(0\.975\)/s.test(source));
    assert(/28%\s*\{[^}]*translate\(2px,-6px\) scale\(0\.992\)/s.test(source));
    assert(/53%\s*\{[^}]*translate\(8px,2px\) scale\(1\.008\)/s.test(source));
    assert(/78%\s*\{[^}]*translate\(0,6px\) scale\(1\.025\)/s.test(source));
    assert(/100%\s*\{[^}]*translate\(-7px,0\) scale\(0\.975\)/s.test(source));
});

test("desktop identity preserves the authored axis and typographic scales", async () => {
    const source = await fetch("../style.css").then((response) => (
        response.text()
    ));
    assert(/--color-text:#3c3c3c;/.test(source));
    assert(/--type-display:clamp\(4rem,5vw,6rem\);/.test(source));
    assert(/--type-information:1\.4rem;/.test(source));
    assert(/--page-margin:150px;/.test(source));
    assert(/font:400 var\(--type-information\)\/1\.2 "Söhne Mono Buch",monospace;/.test(
        source
    ));
    assert(/\.arrival-identity-title\s*\{[^}]*grid-row:2;[^}]*justify-self:center;[^}]*grid-template-columns:max-content max-content;[^}]*column-gap:0\.8ch;/s.test(
        source
    ));
    assert(/\.arrival-identity-artist\s*\{[^}]*align-self:center;[^}]*justify-self:end;[^}]*text-align:right;/s.test(
        source
    ));
    assert(/\.arrival-identity-language\s*\{[^}]*top:31\.2px;[^}]*left:40px;/s.test(
        source
    ));
    assert(/\.arrival-identity-dates\s*\{[^}]*grid-row:1;[^}]*align-self:center;[^}]*justify-self:center;/s.test(
        source
    ));
    assert(/\.arrival-identity-venue\s*\{[^}]*grid-row:3;[^}]*align-self:center;[^}]*justify-self:center;/s.test(
        source
    ));
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
    equal(
        Array.from(page.getElementById("artworkSourceRepresentation").options)
            .map((option) => option.textContent.trim())
            .join("|"),
        "SOURCE A|SOURCE B"
    );
    assert(!page.getElementById("drawCallProbeMode"));
});

test("artwork source policy defaults by browser and permits DEV overrides", () => {
    const chromeDesktop = "Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36";
    const chromeAndroid = "Mozilla/5.0 (Linux; Android 10) Chrome/140.0.0.0 Mobile Safari/537.36";
    const safari = "Mozilla/5.0 Version/18.6 Mobile/15E148 Safari/604.1";
    const firefox = "Mozilla/5.0 Firefox/141.0";
    const edge = "Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0";
    equal(
        selectedArtworkRepresentationId(
            ["a", "b"],
            "https://example.test/",
            chromeDesktop
        ),
        "b"
    );
    equal(
        selectedArtworkRepresentationId(
            ["a", "b"],
            "https://example.test/",
            chromeAndroid
        ),
        "b"
    );
    equal(
        selectedArtworkRepresentationId(
            ["a", "b"],
            "https://example.test/",
            safari
        ),
        "a"
    );
    equal(
        selectedArtworkRepresentationId(
            ["a", "b"],
            "https://example.test/",
            firefox
        ),
        "a"
    );
    equal(
        selectedArtworkRepresentationId(
            ["a", "b"],
            "https://example.test/",
            edge
        ),
        "a"
    );
    equal(
        selectedArtworkRepresentationId(
            ["a", "b"],
            "https://example.test/?debug-artwork-source=a",
            chromeDesktop
        ),
        "a"
    );
    equal(
        selectedArtworkRepresentationId(
            ["a", "b"],
            "https://example.test/?debug-artwork-source=b",
            safari
        ),
        "b"
    );
    equal(
        artworkRepresentationUrlWithoutOverride(
            "https://example.test/?dev=1&debug-artwork-source=b#curtain"
        ),
        "https://example.test/?dev=1#curtain"
    );
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
    equal(fixture.trigger.textContent, "X");
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
    equal(
        fixture.list.querySelector(
            '[aria-current="true"] .conversation-project-title'
        )?.textContent,
        "Airbag"
    );
});

test("Index stays open within Screen 2 and closes after leaving it", () => {
    const fixture = createFixture();
    bindConversationInterface(
        fixture.bar,
        fixture.application,
        fixture.synchronizeViewport,
        fixture.synchronizeNavigation
    );

    fixture.trigger.click();
    assert(!fixture.panel.hidden);
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    fixture.stage.getBoundingClientRect = () => ({
        top: -5,
        bottom: viewportHeight - 5
    });
    window.dispatchEvent(new Event("scroll"));
    assert(!fixture.panel.hidden);

    fixture.stage.getBoundingClientRect = () => ({
        top: -viewportHeight,
        bottom: 0
    });
    window.dispatchEvent(new Event("scroll"));
    assert(fixture.panel.hidden);
    equal(fixture.selections.length, 0);
    equal(fixture.trigger.getAttribute("aria-expanded"), "false");

    fixture.trigger.click();
    fixture.stage.getBoundingClientRect = () => ({
        top: viewportHeight,
        bottom: viewportHeight * 2
    });
    window.dispatchEvent(new Event("scroll"));
    assert(fixture.panel.hidden);
    equal(fixture.selections.length, 0);
});

test("desktop X reuses the existing Index close control", () => {
    const fixture = createFixture();
    bindConversationInterface(
        fixture.bar,
        fixture.application,
        fixture.synchronizeViewport,
        fixture.synchronizeNavigation
    );

    fixture.trigger.click();
    fixture.trigger.click();
    assert(fixture.panel.hidden);
    equal(fixture.trigger.getAttribute("aria-expanded"), "false");
});

test("manual curtain movement can clear only the visual Index selection", () => {
    const fixture = createFixture();
    const controller = bindConversationInterface(
        fixture.bar,
        fixture.application,
        fixture.synchronizeViewport,
        fixture.synchronizeNavigation
    );

    fixture.trigger.click();
    assert(fixture.list.querySelector('[aria-current="true"]'));
    controller.clearProjectSelection();
    assert(!fixture.list.querySelector('[aria-current="true"]'));
    equal(fixture.application.currentProjectIndex, 1);

    controller.showProject(fixture.projects[2]);
    controller.synchronizeProjects();
    equal(
        fixture.list.querySelector('[aria-current="true"]')
            ?.querySelector(".conversation-project-title")?.textContent,
        "Bubles"
    );
});

test("curtain clicks do not select Index rows and drags still clear them", async () => {
    const source = await fetch("../src/application/startSimone.js").then(
        (response) => response.text()
    );
    assert(/revealLocalInteraction\(grabbedInteraction\)\)\s*\{\s*conversation\.showDragHint\(\);/s.test(
        source
    ));
    assert(!/revealLocalInteraction\(grabbedInteraction\)\)\s*\{\s*conversation\.showProject/s.test(
        source
    ));
    assert(/drag\.dragLearned\s*=\s*true;\s*conversation\.clearProjectSelection\(\);/s.test(
        source
    ));
    assert(/touchExploration\.dragLearned\s*=\s*true;\s*conversation\.clearProjectSelection\(\);/s.test(
        source
    ));
});

test("desktop Index rows use aligned compact Buch weight states", async () => {
    const source = await fetch("../style.css").then((response) => (
        response.text()
    ));
    assert(/\.conversation-project-list\s*\{[^}]*left:0;/s.test(source));
    assert(/\.conversation-project-list button\s*\{[^}]*min-height:56px;[^}]*padding:10px 32px 10px 40px;[^}]*font:200 var\(--type-information\)\/1\.2 "Söhne Mono Extraleicht"/s.test(
        source
    ));
    assert(/button:hover,[\s\S]*button\[aria-current="true"\]\s*\{[^}]*font-family:"Söhne Mono Buch"[^}]*font-weight:400;/s.test(
        source
    ));
    assert(/\.conversation-project-list\s*\{[^}]*border-top:0;/s.test(
        source
    ));
    assert(/button:hover\s*\{[^}]*background:transparent;/s.test(source));
    assert(/button\[aria-current="true"\]::before\s*\{[^}]*content:none;/s.test(
        source
    ));
    assert(/#conversationBar\.is-menu-open\s*>\s*\.conversation-menu-trigger\s*\{[^}]*right:calc\(100% - var\(--index-content-width\) \+ 40px\);[^}]*left:auto;[^}]*opacity:1;/s.test(
        source
    ));
    assert(/#conversationBar\s*>\s*\.curtain-index-label\s*\{[^}]*transform:translateY\(12px\);/s.test(
        source
    ));
    assert(/\.conversation-project-title\s*\{[^}]*text-transform:uppercase;/s.test(
        source
    ));
});

test("mobile editorial and Index inherit the approved desktop visual language", async () => {
    const source = await fetch("../style.css").then((response) => (
        response.text()
    ));

    assert(/\.visit-information h2\s*\{[^}]*font:400 var\(--type-section\)\/0\.98 "Söhne Mono Buch",monospace;/s.test(
        source
    ));
    assert(/@media \(max-width:767px\)\s*\{[\s\S]*?--type-body:1\.2rem;/s.test(
        source
    ));
    assert(/@media \(max-width:767px\)\s*\{[\s\S]*?\.editorial-title,\s*\.editorial-actions\s*\{[^}]*align-self:flex-end;[^}]*text-align:right;/s.test(
        source
    ));
    assert(/@media \(max-width:767px\)\s*\{[\s\S]*?\.conversation-project-title\s*\{[^}]*text-transform:uppercase;/s.test(
        source
    ));
    assert(/@media \(max-width:767px\)\s*\{[\s\S]*?\.conversation-project-list button\s*\{[^}]*font:200 var\(--type-information\)\/1\.2[^}]*"Söhne Mono Extraleicht",monospace;/s.test(
        source
    ));
    assert(/@media \(max-width:767px\)\s*\{[\s\S]*?\.conversation-project-list button\s*\{[^}]*min-height:52px;[^}]*padding:8px 24px;/s.test(
        source
    ));
    assert(/@media \(max-width:767px\)[\s\S]*?button\[aria-current="true"\]::before\s*\{[^}]*content:none;/s.test(
        source
    ));
    assert(/@media \(max-width:767px\)[\s\S]*?#conversationBar\.is-menu-open > \.conversation-menu-trigger\s*\{[^}]*right:18px;[^}]*left:auto;[^}]*width:auto;[^}]*opacity:1;/s.test(
        source
    ));
    assert(!/#conversationBar\.is-menu-open > \.curtain-index-label\s*\{[^}]*visibility:hidden;/s.test(
        source
    ));
});

test("curtain canvas preserves native vertical touch panning", async () => {
    const source = await fetch("../style.css").then((response) => response.text());
    assert(/\.curtain-presentation canvas\s*\{[^}]*touch-action:pan-y;/s.test(
        source
    ));
});

function createFixture() {
    const stage = document.createElement("section");
    stage.className = "curtain-sticky-stage";
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
    stage.append(bar);
    document.body.append(stage);
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
        stage,
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

function approximatelyEqual(actual, expected, tolerance = 1e-12) {
    assert(
        Math.abs(actual - expected) <= tolerance,
        `Expected ${actual} to be within ${tolerance} of ${expected}`
    );
}

function createEntranceMotion() {
    return new CurtainEntranceMotion({
        initialOffset: CURTAIN_ENTRANCE_CONFIG.startingOffsetViewportWidths,
        delayProgress: CURTAIN_ENTRANCE_CONFIG.delayProgress,
        offsetRemainingAtSnap: CURTAIN_ENTRANCE_CONFIG.offsetRemainingAtSnap,
        snapFlightDuration: CURTAIN_ENTRANCE_CONFIG.snapFlightDuration
    });
}

function projectedColumn(periodIndex, targetX) {
    return {
        width: 10,
        placement: { periodIndex, targetX }
    };
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
