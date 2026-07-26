import {
    artworkLayout,
    resolveArtworkLayout
} from "./ArtworkLayout.js";

export function createProjectNavigation({
    source,
    loadedImageCount,
    layout = artworkLayout
}) {
    validateImageCount(loadedImageCount);
    const resolvedLayout = resolveArtworkLayout(layout);
    const parsedProjects = parseProjects(source);
    const totalUnits = loadedImageCount * resolvedLayout.repetitionsPerImage;
    let nextUnit = 0;
    const projects = parsedProjects.map(({ title, span }) => {
        const startUnit = nextUnit;
        const endUnit = startUnit + span;
        nextUnit = endUnit;

        return Object.freeze({
            title,
            span,
            startUnit,
            endUnit,
            artworkStart: startUnit * resolvedLayout.unitWidth,
            artworkEnd: endUnit * resolvedLayout.unitWidth
        });
    });
    const projectSpanUnits = nextUnit;
    const unusedUnits = totalUnits - projectSpanUnits;

    if (unusedUnits < 0) {
        return Object.freeze({
            enabled: false,
            error: `Project spans require ${projectSpanUnits} units, but `
                + `only ${totalUnits} artwork units are available.`,
            layout: resolvedLayout,
            loadedImageCount,
            totalUnits,
            projectSpanUnits,
            unusedUnits,
            projects: Object.freeze(projects)
        });
    }

    return Object.freeze({
        enabled: true,
        error: null,
        layout: resolvedLayout,
        loadedImageCount,
        totalUnits,
        projectSpanUnits,
        unusedUnits,
        projects: Object.freeze(projects)
    });
}

export function parseProjects(source) {
    if (typeof source !== "string") {
        throw new TypeError("Project navigation source must be text.");
    }

    const projects = [];
    const lines = source.replace(/^\uFEFF/u, "").split(/\r\n?|\n/u);

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        if (line.trim() === "" || line.startsWith("#")) {
            continue;
        }

        const fields = parseCsvLine(line, index + 1);
        if (fields.length < 2) {
            throw new Error(
                `projects.txt line ${index + 1} must contain a title and span.`
            );
        }

        const title = fields.slice(0, -1).join(",");
        const spanText = fields.at(-1).trim();
        const span = Number(spanText);
        if (title === "") {
            throw new Error(
                `projects.txt line ${index + 1} has an empty title.`
            );
        }
        if (!/^\d+$/u.test(spanText) || !Number.isSafeInteger(span)
            || span <= 0) {
            throw new Error(
                `projects.txt line ${index + 1} span must be a positive integer.`
            );
        }

        projects.push(Object.freeze({ title, span }));
    }

    return Object.freeze(projects);
}

function parseCsvLine(line, lineNumber) {
    const fields = [];
    let field = "";
    let quoted = false;

    for (let index = 0; index < line.length; index += 1) {
        const character = line[index];
        if (character === "\"") {
            if (quoted && line[index + 1] === "\"") {
                field += "\"";
                index += 1;
            } else {
                quoted = !quoted;
            }
        } else if (character === "," && !quoted) {
            fields.push(field);
            field = "";
        } else {
            field += character;
        }
    }

    if (quoted) {
        throw new Error(
            `projects.txt line ${lineNumber} has an unterminated quote.`
        );
    }

    fields.push(field);
    return fields;
}

function validateImageCount(value) {
    if (!Number.isSafeInteger(value) || value < 1) {
        throw new RangeError(
            "Loaded image count must be a positive integer."
        );
    }
}
