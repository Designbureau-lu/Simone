export const artworkLayout = Object.freeze({
    gutterWidth: 40,
    columnWidth: 400,
    repetitionsPerImage: 10
});

export function resolveArtworkLayout(layout = artworkLayout) {
    const unitWidth = layout.gutterWidth + layout.columnWidth;

    return Object.freeze({
        ...layout,
        unitWidth
    });
}
