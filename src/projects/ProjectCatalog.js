const REQUIRED_COLUMNS = Object.freeze([
    "Project",
    "Year",
    "Columns",
    "Page"
]);

const LOGICAL_COLUMN_WIDTH = 500;
const LOGICAL_HEIGHT = 2500;
const SOURCE_B_SCALE = 0.5;

export const PROJECT_REPRESENTATION_IDS = Object.freeze(["a", "b"]);

export function representationLabel(id) {
    return `SOURCE ${id.toUpperCase()}`;
}

/** Parses one authoritative InDesign project export into curtain segments. */
export function projectCatalogFromTsv(source, exportBaseUrl) {
    if (typeof source !== "string") {
        throw new TypeError("Project catalog source must be text.");
    }

    const lines = source.replace(/^\uFEFF/u, "").split(/\r\n?|\n/u);
    while (lines.at(-1) === "") {
        lines.pop();
    }
    if (lines.length < 2) {
        throw new TypeError("Project catalog must contain a header and projects.");
    }

    validateHeader(lines[0]);
    const pages = new Set();
    const parsed = lines.slice(1).map((line, index) => (
        parseProjectRow(line, index + 2, pages)
    ));
    parsed.sort((first, second) => first.page - second.page);

    const baseUrl = validatedBaseUrl(exportBaseUrl);
    let sourceStart = 0;
    const projects = parsed.map((project, orderIndex) => {
        const logicalWidth = project.columns * LOGICAL_COLUMN_WIDTH;
        const sourceEnd = sourceStart + logicalWidth;
        const filename = projectFilename(project.page, project.title);
        const record = Object.freeze({
            title: project.title,
            year: project.year,
            columns: project.columns,
            page: project.page,
            orderIndex,
            logicalWidth,
            logicalHeight: LOGICAL_HEIGHT,
            sourceStart,
            sourceEnd,
            filename,
            representations: Object.freeze({
                a: representationFor({
                    id: "a",
                    directory: "source-a",
                    filename,
                    baseUrl,
                    width: logicalWidth,
                    height: LOGICAL_HEIGHT,
                    scale: 1
                }),
                b: representationFor({
                    id: "b",
                    directory: "source-b",
                    filename,
                    baseUrl,
                    width: logicalWidth * SOURCE_B_SCALE,
                    height: LOGICAL_HEIGHT * SOURCE_B_SCALE,
                    scale: SOURCE_B_SCALE
                })
            })
        });
        sourceStart = sourceEnd;
        return record;
    });

    return Object.freeze({
        projects: Object.freeze(projects),
        logicalWidth: sourceStart,
        logicalHeight: LOGICAL_HEIGHT
    });
}

/** Adapts catalog projects to ImmutableArtwork's selected-source metadata. */
export function artworkSegmentsFromProjectCatalog(catalog, representationId) {
    if (!catalog
        || !Array.isArray(catalog.projects)
        || !PROJECT_REPRESENTATION_IDS.includes(representationId)) {
        throw new TypeError("Project artwork selection is invalid.");
    }

    return Object.freeze(catalog.projects.map((project) => {
        const representation = project.representations?.[representationId];
        if (!representation) {
            throw new RangeError(
                `Artwork representation "${representationId}" is missing `
                + `for project on Page ${project.page}.`
            );
        }
        return Object.freeze({
            name: project.title,
            url: representation.url,
            width: project.logicalWidth,
            height: project.logicalHeight,
            sourceWidth: representation.width,
            sourceHeight: representation.height,
            representationId,
            representationLabel: representationLabel(representationId)
        });
    }));
}

function validateHeader(line) {
    const columns = line.split("\t");
    if (columns.length !== REQUIRED_COLUMNS.length
        || columns.some((column, index) => column !== REQUIRED_COLUMNS[index])) {
        throw new TypeError(
            `Project catalog header must be exactly "${REQUIRED_COLUMNS.join("\\t")}".`
        );
    }
}

function parseProjectRow(line, lineNumber, pages) {
    const fields = line.split("\t");
    if (fields.length !== REQUIRED_COLUMNS.length) {
        throw new TypeError(
            `SIMONE-projects.txt line ${lineNumber} must contain exactly four tab-separated fields.`
        );
    }

    const [title, year, columnsText, pageText] = fields;
    validateRequiredText(title, "Project", lineNumber);
    validateRequiredText(year, "Year", lineNumber);
    const columns = integerField(columnsText, "Columns", lineNumber);
    const page = integerField(pageText, "Page", lineNumber);

    if (columns < 1 || columns > 6) {
        throw new RangeError(
            `SIMONE-projects.txt line ${lineNumber} Columns must be an integer from 1 to 6.`
        );
    }
    if (page < 1) {
        throw new RangeError(
            `SIMONE-projects.txt line ${lineNumber} Page must be a positive integer.`
        );
    }
    if (pages.has(page)) {
        throw new RangeError(
            `SIMONE-projects.txt line ${lineNumber} repeats Page ${page}.`
        );
    }
    pages.add(page);

    return Object.freeze({ title, year, columns, page });
}

function validateRequiredText(value, name, lineNumber) {
    if (value === "") {
        throw new TypeError(
            `SIMONE-projects.txt line ${lineNumber} ${name} must not be empty.`
        );
    }
    if (value.trim() !== value) {
        throw new TypeError(
            `SIMONE-projects.txt line ${lineNumber} ${name} has surrounding whitespace.`
        );
    }
}

function integerField(value, name, lineNumber) {
    if (!/^\d+$/u.test(value)) {
        throw new TypeError(
            `SIMONE-projects.txt line ${lineNumber} ${name} must be an integer.`
        );
    }
    const number = Number(value);
    if (!Number.isSafeInteger(number)) {
        throw new RangeError(
            `SIMONE-projects.txt line ${lineNumber} ${name} is outside the supported range.`
        );
    }
    return number;
}

function validatedBaseUrl(value) {
    try {
        return new URL(value);
    } catch (error) {
        throw new TypeError("Project catalog export URL is invalid.", {
            cause: error
        });
    }
}

function representationFor({
    id,
    directory,
    filename,
    baseUrl,
    width,
    height,
    scale
}) {
    return Object.freeze({
        id,
        url: new URL(
            `${directory}/${encodeURIComponent(filename)}`,
            baseUrl
        ).href,
        width,
        height,
        scale
    });
}

function projectFilename(page, title) {
    const technicalTitle = title.toLowerCase().normalize("NFC");
    return `${String(page).padStart(2, "0")}_${technicalTitle}.jpg`;
}
