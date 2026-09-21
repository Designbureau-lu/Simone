/** Creates the UI navigation view over one validated ProjectCatalog. */
export function createProjectNavigation(catalog) {
    if (!catalog
        || !Array.isArray(catalog.projects)
        || !Number.isSafeInteger(catalog.logicalWidth)
        || catalog.logicalWidth <= 0) {
        throw new TypeError("Project navigation requires a valid catalog.");
    }

    validateProjectRanges(catalog.projects, catalog.logicalWidth);

    return Object.freeze({
        enabled: true,
        error: null,
        logicalWidth: catalog.logicalWidth,
        projects: catalog.projects
    });
}

function validateProjectRanges(projects, logicalWidth) {
    if (projects.length < 1) {
        throw new TypeError("Project navigation requires at least one project.");
    }

    let expectedStart = 0;
    for (const project of projects) {
        if (!project
            || !Number.isSafeInteger(project.sourceStart)
            || !Number.isSafeInteger(project.sourceEnd)
            || !Number.isSafeInteger(project.logicalWidth)
            || project.sourceStart !== expectedStart
            || project.sourceEnd !== project.sourceStart + project.logicalWidth
            || project.sourceEnd <= project.sourceStart) {
            throw new RangeError(
                "Project navigation requires continuous intrinsic ranges."
            );
        }
        expectedStart = project.sourceEnd;
    }

    if (expectedStart !== logicalWidth) {
        throw new RangeError(
            "Project navigation width must equal the catalog width."
        );
    }
}
