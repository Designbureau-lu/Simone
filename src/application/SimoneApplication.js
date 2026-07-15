/**
 * Application layer: coordinates the domain pipeline and owns no pixel logic.
 *
 * Artwork -> immutable columns -> phase -> surface geometry -> shading -> renderer
 */
export class SimoneApplication {
    constructor({ artworkLoader, parameters, phaseResolver, surfaces, shading, renderer }) {
        this.artworkLoader = artworkLoader;
        this.parameters = parameters;
        this.phaseResolver = phaseResolver;
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
        const phase = this.phaseResolver.resolve(parameters);
        const surface = this.surfaces[phase];
        const appearance = this.shading.appearanceFor(parameters);

        this.renderer.beginFrame(
            surface.frameFor(this.artwork, parameters),
            appearance
        );
        let lastDestinationWidth = 1;

        for (let sourceX = 0; sourceX < this.artwork.width; sourceX += 1) {
            const column = this.artwork.columnAt(sourceX);
            const placement = surface.mapColumn(column, parameters);
            const nextPlacement = sourceX + 1 < this.artwork.width
                ? surface.mapColumn(this.artwork.columnAt(sourceX + 1), parameters)
                : null;
            const destinationWidth = nextPlacement
                && nextPlacement.branch === placement.branch
                ? nextPlacement.targetX - placement.targetX
                : lastDestinationWidth;
            const brightness = this.shading.factorFor(placement, parameters);

            if (destinationWidth !== 0) {
                lastDestinationWidth = destinationWidth;
            }

            this.renderer.drawColumn(
                column,
                {
                    x: placement.targetX,
                    y: placement.targetY,
                    width: destinationWidth
                },
                {
                    brightness,
                    alpha: placement.alpha,
                    branch: placement.branch,
                    localSlope: placement.localSlope
                }
            );
        }

        this.renderer.endFrame();
    }
}
