import { createI18n, preferredLanguage, richFragment } from "../src/i18n/i18n.js";

const [html, en, fr] = await Promise.all([
    fetch("../index.html").then((r) => r.text()),
    fetch("../locales/en.json").then((r) => r.text()),
    fetch("../locales/fr.json").then((r) => r.text())
]);
const tests = [];
function test(name, body) { tests.push({ name, body }); }
function assert(condition, message = "Assertion failed") {
    if (!condition) { throw new Error(message); }
}
function fixture({ saved = null, browser = "en", load, storage, ...options } = {}) {
    const page = new DOMParser().parseFromString(html, "text/html");
    const errors = [];
    const writes = [];
    const controller = createI18n({
        document: page,
        load: load ?? (async (language) => language === "en" ? en : fr),
        storage: storage ?? (() => ({
            getItem: () => saved,
            setItem: (key, value) => writes.push([key, value])
        })),
        browserLanguage: () => browser,
        reportError: (error) => errors.push(error.message),
        ...options
    });
    return { page, errors, writes, controller };
}
function changed(source, mutate) {
    const value = JSON.parse(source);
    mutate(value);
    return JSON.stringify(value);
}

test("saved choice wins; primary browser language resolves French variants and English fallback", () => {
    for (const [saved, browser, expected] of [
        ["en", "fr-LU", "en"], ["fr", "en-US", "fr"],
        [null, "fr-CA", "fr"], [null, "FR", "fr"],
        [null, "en-GB", "en"], [null, "de-DE", "en"],
        ["invalid", "fr", "fr"], [null, undefined, "en"]
    ]) { assert(preferredLanguage(saved, browser) === expected); }
});

test("production JSON covers every binding and dynamic key; French placeholders are exact English copies", async () => {
    const f = fixture();
    assert(await f.controller.start());
    assert(await f.controller.setLanguage("fr"));
    assert(f.errors.length === 0);
    assert(f.page.documentElement.lang === "fr");
    const data = JSON.parse(fr);
    assert(data._meta.englishPlaceholders.join("|") === "artist.biography");
    assert(f.page.querySelector('[data-i18n="actions.planVisit"]').lang === "fr");
    assert(f.page.querySelector(".editorial-section").lang === "fr");
    assert(f.page.querySelector('[data-i18n-rich="artist.biography"]').lang === "en");
});

test("French editorial copy preserves emphasis, pending biography, and the existing press-release link", async () => {
    const f = fixture();
    await f.controller.start();
    const href = f.page.querySelector(".press-release-link").getAttribute("href");
    const biography = f.page.querySelector('[data-i18n-rich="artist.biography"]').textContent;
    await f.controller.setLanguage("fr");
    assert(f.page.querySelector('[data-i18n-rich="presentation.intro"] em').textContent === "Lëtzebuerger Konschtpräis");
    const floors = ["level1", "level23", "level4", "level5"].map((key) => (
        f.page.querySelector(`[data-i18n-rich="presentation.${key}"] strong`).textContent
    ));
    assert(floors.join("|") === "Etage -1|Etage -2/-3|Etage -4|Etage -5");
    assert(f.page.querySelector('[data-i18n-rich="presentation.level1"] em').textContent === "Chewing gum");
    assert(f.page.querySelector('[data-i18n-rich="presentation.level5"]').lastElementChild.textContent === "500 pièces.");
    assert(f.page.querySelector('[data-i18n="actions.pressRelease"]').textContent === "Communiqué de presse");
    assert(f.page.querySelector(".press-release-link").getAttribute("href") === href);
    assert(f.page.querySelector('[data-i18n-rich="artist.biography"]').textContent === biography);
    assert(!/À venir|Press release link:|FR:|&#(?:x[0-9a-f]+|[0-9]+);/i.test(f.page.body.textContent));
    await f.controller.setLanguage("en");
    assert(f.page.querySelector('[data-i18n="actions.pressRelease"]').textContent === "Press release");
});

test("English JSON agrees with the original HTML fallback, including inline emphasis", async () => {
    const f = fixture();
    const before = f.page.body.textContent;
    const italics = f.page.querySelectorAll(".editorial-body em").length;
    const bold = f.page.querySelectorAll(".editorial-body strong").length;
    assert(await f.controller.start());
    assert(f.page.body.textContent === before);
    assert(f.page.querySelectorAll(".editorial-body em").length === italics);
    assert(f.page.querySelectorAll(".editorial-body strong").length === bold);
});

test("manual choice persists and language buttons expose selected state", async () => {
    const f = fixture({ browser: "fr" });
    await f.controller.start();
    assert(f.writes.length === 0);
    await f.controller.setLanguage("en", { persist: true });
    assert(f.writes[0].join("|") === "simone.language|en");
    assert(f.page.querySelector('[data-language="en"]').getAttribute("aria-pressed") === "true");
    assert(f.page.querySelector('[data-language="fr"]').getAttribute("aria-pressed") === "false");
});

test("native language buttons activate the locale and keep their original nodes", async () => {
    const f = fixture();
    await f.controller.start();
    const button = f.page.querySelector('[data-language="fr"]');
    assert(button.tagName === "BUTTON" && button.type === "button" && button.tabIndex === 0);
    const changed = new Promise((resolve) => {
        const stop = f.controller.onChange(() => { stop(); resolve(true); });
        setTimeout(() => { stop(); resolve(false); }, 1000);
    });
    button.click();
    assert(await changed);
    assert(f.controller.language === "fr");
    assert(f.page.querySelector('[data-language="fr"]') === button);
    assert(button.getAttribute("aria-pressed") === "true");
    assert(f.writes.at(-1)[1] === "fr");
});

test("storage failure does not prevent language detection or switching", async () => {
    const f = fixture({ browser: "fr-FR", storage: () => { throw Error("Denied"); } });
    assert(await f.controller.start());
    assert(f.controller.language === "fr");
    assert(await f.controller.setLanguage("en", { persist: true }));
});

test("network failure leaves readable English fallback and all existing nodes intact", async () => {
    const f = fixture({ browser: "fr", load: async () => { throw Error("Offline"); } });
    const before = f.page.body.innerHTML;
    assert(!await f.controller.start());
    assert(f.page.body.innerHTML === before);
    assert(f.page.documentElement.lang === "en");
    assert(f.errors.length === 1);
});

test("invalid JSON is reported without partially applying a language", async () => {
    const f = fixture({ load: async () => "{" });
    assert(!await f.controller.start());
    assert(f.errors[0].includes("Invalid JSON"));
});

test("missing keys and unknown keys are rejected", async () => {
    for (const mutate of [
        (d) => { delete d.actions.planVisit; },
        (d) => { d.actions.typo = "Unexpected"; }
    ]) {
        const f = fixture({ load: async () => changed(en, mutate) });
        assert(!await f.controller.start());
        assert(f.errors[0].includes("translation keys"));
    }
});

test("unsupported markup is rejected in plain and formatted translations", async () => {
    for (const mutate of [
        (d) => { d.actions.planVisit = '<img src="invalid" onerror="alert(1)">'; },
        (d) => { d.presentation.intro = '<a href="javascript:alert(1)">Unsafe</a>'; },
        (d) => { d.presentation.intro = '<em class="changed">No attributes</em>'; },
        (d) => { d.presentation.intro = '<em>Unclosed'; },
        (d) => { d.presentation.intro = '<em><strong>Crossed</em></strong>'; }
    ]) {
        const f = fixture({ load: async () => changed(en, mutate) });
        assert(!await f.controller.start());
        assert(f.errors.length === 1);
    }
    const fragment = richFragment("A <em>title</em> and <strong>label</strong>", document);
    assert(fragment.querySelector("em").textContent === "title");
    assert(fragment.querySelector("strong").textContent === "label");
});

test("placeholder tokens must match; project titles are interpolated as data", async () => {
    const f = fixture();
    await f.controller.start();
    assert(f.controller.translate("navigation.position", undefined, {
        current: 2, total: 50, title: "Le grand soufflé"
    }) === "Project 2 / 50 — Le grand soufflé");
    const bad = fixture({ load: async () => changed(en, (d) => {
        d.navigation.position = "Project {wrong}";
    }) });
    assert(!await bad.controller.start());
});

test("new approved copy supports emphasis while pending copy remains English", async () => {
    const f = fixture({ load: async (language) => language === "en" ? en : changed(fr, (d) => {
        d.presentation.intro = "Approved <em>example</em>";
        d._meta.englishPlaceholders = d._meta.englishPlaceholders.filter(
            (key) => key !== "presentation.intro"
        );
    }) });
    await f.controller.start();
    const canvas = f.page.querySelector("canvas");
    const link = f.page.querySelector(".press-release-link");
    const date = f.page.querySelector("time");
    await f.controller.setLanguage("fr");
    const intro = f.page.querySelector('[data-i18n-rich="presentation.intro"]');
    assert(intro.lang === "fr" && intro.querySelector("em").textContent === "example");
    assert(f.page.querySelector("canvas") === canvas);
    assert(f.page.querySelector(".press-release-link") === link);
    assert(f.page.querySelector("time") === date);
});

test("last request wins and locale dictionaries are cached", async () => {
    let releaseFrench;
    const counts = { en: 0, fr: 0 };
    const f = fixture({ load: (language) => {
        counts[language]++;
        return language === "en" ? Promise.resolve(en) : new Promise((resolve) => {
            releaseFrench = () => resolve(fr);
        });
    } });
    await f.controller.start();
    const french = f.controller.setLanguage("fr", { persist: true });
    while (!releaseFrench) { await Promise.resolve(); }
    const english = f.controller.setLanguage("en", { persist: true });
    releaseFrench();
    await Promise.all([french, english]);
    assert(f.controller.language === "en");
    assert(f.writes.length === 1 && f.writes[0][1] === "en");
    await f.controller.setLanguage("fr");
    assert(counts.en === 1 && counts.fr === 1);
});

const failures = [];
for (const { name, body } of tests) {
    try { await body(); } catch (error) { failures.push(`${name}: ${error.message}`); }
}
const summary = failures.length ? `FAIL ${tests.length - failures.length}/${tests.length}\n${failures.join("\n")}` : `PASS ${tests.length}/${tests.length}`;
document.querySelector("#results").textContent = summary;
document.title = summary.split("\n")[0];
