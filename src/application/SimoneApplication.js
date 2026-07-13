/**
 * Application layer: coordinates the domain pipeline and owns no pixel logic.
 *
 * Artwork -> immutable columns -> regime -> surface geometry -> shading -> renderer
 */
export class SimoneApplication {
    constructor({ artworkLoader, parameters, regimeResolver, surfaces, shading, renderer }) {
        this.artworkLoader = artworkLoader;
        this.parameters = parameters;
        this.regimeResolver = regimeResolver;
        this.surfaces = surfaces;
        this.shading = shading;
        this.renderer = renderer;
        this.artwork = null;
    }

    async importArtwork(file) {
        this.artwork = await this.artworkLoader(file);
        this.render();
    }

    updateSurface(parameters) {
        this.parameters.configure(parameters);

        if (this.artwork) {
            this.render();
        }
    }

    render() {
        if (!this.artwork) {
            return;
        }

        const parameters = this.parameters.resolve();
        const regime = this.regimeResolver.resolve(parameters);
        const surface = this.surfaces[regime];

        this.renderer.beginFrame(surface.frameFor(this.artwork, parameters));

        for (let sourceX = 0; sourceX < this.artwork.width; sourceX += 1) {
            const column = this.artwork.columnAt(sourceX);
            const placement = surface.mapColumn(column, parameters);
            const opacity = this.shading.factorFor(placement, parameters);

            this.renderer.drawColumn(
                column,
                { x: placement.targetX, y: placement.targetY },
                { opacity }
            );
        }

        this.renderer.endFrame();
    }
}
