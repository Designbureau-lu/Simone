const LANGUAGES = new Set(["en", "fr"]);
const STORAGE_KEY = "simone.language";
const BINDINGS = Object.freeze([
    ["data-i18n", null],
    ["data-i18n-rich", "rich"],
    ["data-i18n-aria-label", "aria-label"],
    ["data-i18n-alt", "alt"]
]);
const DYNAMIC_ENGLISH = Object.freeze({
    "navigation.open": "Open project list",
    "navigation.close": "Close project list",
    "navigation.choose": "Choose project…",
    "navigation.empty": "Project — / —",
    "navigation.position": "Project {current} / {total} — {title}"
});

export function preferredLanguage(saved, browserLanguage) {
    if (LANGUAGES.has(saved)) {
        return saved;
    }
    return String(browserLanguage).toLowerCase().split("-")[0] === "fr"
        ? "fr"
        : "en";
}

function flatten(value, prefix = "", result = new Map()) {
    for (const [name, entry] of Object.entries(value)) {
        if (name === "_meta" && !prefix) {
            continue;
        }
        if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(name)) {
            throw new Error(`Invalid translation key: ${name}`);
        }
        const key = prefix ? `${prefix}.${name}` : name;
        if (typeof entry === "string") {
            result.set(key, entry);
        } else if (entry && typeof entry === "object" && !Array.isArray(entry)) {
            flatten(entry, key, result);
        } else {
            throw new Error(`Translation must be a string: ${key}`);
        }
    }
    return result;
}

function placeholders(value) {
    return [...new Set(Array.from(value.matchAll(/\{(\w+)\}/g), (m) => m[1]))]
        .sort().join(",");
}

export function richFragment(value, document) {
    // Only these exact inline tags are accepted, with no attributes or HTML URLs.
    if (/[<>]/.test(value.replace(/<\/?(?:em|strong)>/g, ""))) {
        throw new Error("Only <em> and <strong> markup is supported.");
    }
    const stack = [];
    for (const match of value.matchAll(/<(\/?)(em|strong)>/g)) {
        if (match[1]) {
            if (stack.pop() !== match[2]) {
                throw new Error("Inline translation tags must be properly nested.");
            }
        } else {
            stack.push(match[2]);
        }
    }
    if (stack.length) {
        throw new Error("Inline translation tags must be closed.");
    }
    const template = document.createElement("template");
    template.innerHTML = value;
    for (const element of template.content.querySelectorAll("*")) {
        if (!["EM", "STRONG"].includes(element.tagName)
            || element.attributes.length !== 0) {
            throw new Error("Unsupported translation markup.");
        }
    }
    return template.content;
}

export function parseDictionary(source, language, schema, document) {
    let data;
    try {
        data = JSON.parse(source);
    } catch {
        throw new Error(`Invalid JSON in locales/${language}.json`);
    }
    if (!data || Array.isArray(data) || typeof data !== "object"
        || data._meta?.locale !== language
        || !Array.isArray(data._meta?.englishPlaceholders)) {
        throw new Error(`Invalid locale metadata: ${language}`);
    }
    const messages = flatten(data);
    if (messages.size !== schema.size
        || [...schema.keys()].some((key) => !messages.has(key))) {
        throw new Error(`Missing or unexpected translation keys: ${language}`);
    }
    for (const [key, entry] of schema) {
        const value = messages.get(key);
        if (!value.trim() || placeholders(value) !== placeholders(entry.fallback)) {
            throw new Error(`Invalid translation or placeholders: ${key}`);
        }
        if (entry.rich) {
            richFragment(value, document);
        } else if (/[<>]/.test(value)) {
            throw new Error(`Markup is not supported in ${key}`);
        }
    }
    const englishPlaceholders = new Set(data._meta.englishPlaceholders);
    if (englishPlaceholders.size !== data._meta.englishPlaceholders.length
        || [...englishPlaceholders].some((key) => !messages.has(key))
        || (language === "en" && englishPlaceholders.size !== 0)) {
        throw new Error(`Invalid English placeholder list: ${language}`);
    }
    return { messages, englishPlaceholders };
}

function collectSchema(document) {
    const schema = new Map(Object.entries(DYNAMIC_ENGLISH).map(
        ([key, fallback]) => [key, { fallback, rich: false }]
    ));
    for (const [binding, attribute] of BINDINGS) {
        for (const element of document.querySelectorAll(`[${binding}]`)) {
            const fallback = attribute === "rich"
                ? element.innerHTML
                : attribute ? element.getAttribute(attribute) : element.textContent.trim();
            schema.set(element.getAttribute(binding), {
                fallback,
                rich: attribute === "rich"
            });
        }
    }
    return schema;
}

async function loadLocale(language) {
    const response = await fetch(new URL(`../../locales/${language}.json`, import.meta.url));
    if (!response.ok) {
        throw new Error(`Could not load ${language} translations (${response.status}).`);
    }
    return response.text();
}

export function createI18n({
    document = globalThis.document,
    load = loadLocale,
    storage = () => globalThis.localStorage,
    browserLanguage = () => globalThis.navigator.languages?.[0]
        ?? globalThis.navigator.language,
    reportError = (error) => console.warn("SIMONE translations:", error)
} = {}) {
    const listeners = new Set();
    const cache = new Map();
    let language = "en";
    let current = null;
    let english = null;
    let schema = null;
    let request = 0;
    let started = false;

    const readSaved = () => {
        try { return storage()?.getItem(STORAGE_KEY); } catch { return null; }
    };
    const save = (value) => {
        try { storage()?.setItem(STORAGE_KEY, value); } catch { /* Storage is optional. */ }
    };
    const dictionary = (value) => {
        if (!cache.has(value)) {
            cache.set(value, Promise.resolve().then(() => load(value)).then(
                (source) => parseDictionary(source, value, schema, document)
            ).catch((error) => {
                cache.delete(value);
                throw error;
            }));
        }
        return cache.get(value);
    };
    const languageFor = (key) => current?.englishPlaceholders.has(key) ? "en" : language;
    const translate = (key, fallback = DYNAMIC_ENGLISH[key], values = {}) => {
        const message = current?.messages.get(key) ?? english?.messages.get(key) ?? fallback;
        if (typeof message !== "string") {
            throw new Error(`Unknown translation: ${key}`);
        }
        return message.replace(/\{(\w+)\}/g, (match, name) => (
            Object.hasOwn(values, name) ? String(values[name]) : match
        ));
    };
    const apply = () => {
        document.documentElement.lang = language;
        for (const [binding, attribute] of BINDINGS) {
            for (const element of document.querySelectorAll(`[${binding}]`)) {
                const key = element.getAttribute(binding);
                const value = translate(key);
                if (attribute === "rich") {
                    if (element.innerHTML !== value) {
                        element.replaceChildren(richFragment(value, document));
                    }
                } else if (attribute) {
                    element.setAttribute(attribute, value);
                } else if (element.textContent.trim() !== value) {
                    element.textContent = value;
                }
                // English placeholders must not be pronounced as French.
                element.lang = languageFor(key);
            }
        }
        for (const section of document.querySelectorAll("[data-i18n-section]")) {
            const keys = Array.from(section.querySelectorAll("[data-i18n], [data-i18n-rich]"),
                (element) => element.dataset.i18n ?? element.dataset.i18nRich);
            section.lang = keys.every((key) => languageFor(key) === "en") ? "en" : language;
        }
        for (const button of document.querySelectorAll("[data-language]")) {
            button.setAttribute("aria-pressed", String(button.dataset.language === language));
        }
    };
    const setLanguage = async (next, { persist = false } = {}) => {
        if (!LANGUAGES.has(next)) {
            return false;
        }
        schema ??= collectSchema(document);
        const ticket = ++request;
        try {
            const source = await dictionary("en");
            const target = next === "en" ? source : await dictionary(next);
            for (const key of target.englishPlaceholders) {
                if (target.messages.get(key) !== source.messages.get(key)) {
                    throw new Error(`English placeholder differs from source: ${key}`);
                }
            }
            if (ticket !== request) {
                return false;
            }
            english = source;
            current = target;
            language = next;
            apply();
            for (const listener of listeners) {
                listener();
            }
            if (persist) { save(next); }
            return true;
        } catch (error) {
            reportError(error);
            return false;
        }
    };
    return Object.freeze({
        translate,
        languageFor,
        setLanguage,
        onChange(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        get language() { return language; },
        start() {
            if (started) { return Promise.resolve(false); }
            started = true;
            for (const button of document.querySelectorAll("[data-language]")) {
                button.addEventListener("click", () => {
                    void setLanguage(button.dataset.language, { persist: true });
                });
            }
            return setLanguage(preferredLanguage(readSaved(), browserLanguage()));
        }
    });
}

export const i18n = createI18n();
