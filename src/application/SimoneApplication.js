/**
 * Application layer: coordinates the domain pipeline and owns no pixel logic.
 *
 * Artwork -> immutable columns -> geometry -> visibility -> renderer
 */
export class SimoneApplication {
    constructor({ artworkLoader, geometry, visibility, renderer }) {
        this.artworkLoader = artworkLoader;
        this.geometry = geometry;
        this.visibility = visibility;
        this.renderer = renderer;
    }

    async importArtwork(file) {
        const artwork = await this.artworkLoader(file);
        this.render(artwork);
    }

    render(artwork) {
        this.renderer.beginFrame(artwork);

        for (let sourceX = 0; sourceX < artwork.width; sourceX += 1) {
            const column = artwork.columnAt(sourceX);
            const placement = this.geometry.mapColumn(column);

            if (!this.visibility.isVisible(column, placement)) {
                continue;
            }

            const appearance = this.visibility.appearanceFor(column, placement);
            this.renderer.drawColumn(column, placement, appearance);
        }

        this.renderer.endFrame();
    }
}
