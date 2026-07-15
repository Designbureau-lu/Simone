/**
 * Application layer: coordinates the domain pipeline and owns no pixel logic.
 *
 * Artwork -> immutable columns -> phase -> surface geometry -> shading -> renderer
 */
export class SimoneApplication {
    constructor({
        artworkLoader,
        parameters,
        curtainField,
        phaseResolver,
        surfaces,
        shading,
        renderer
    }) {
        this.artworkLoader = artworkLoader;
        this.parameters = parameters;
        this.curtainField = curtainField;
        this.phaseResolver = phaseResolver;
        this.surfaces = surfaces;
        this.shading = shading;
        this.renderer = renderer;
        this.artwork = null;
    }

    async importArtwork(file) {
        this.artwork = await this.artworkLoader(file);
        this.#configureCurtainField();
        this.render();
    }

    updateSurface(values) {
        const {
            visibleFactor = this.curtainField.visibleFactor,
            ...configuration
        } = values;

        this.parameters.configure(configuration);
        const constrainedVisibleFactor = this.parameters.resolve(
            visibleFactor
        ).visibleFactor;
        this.curtainField.setVisibleFactorForAll(constrainedVisibleFactor);

        if (this.artwork) {
            this.#configureCurtainField();
            this.render();
        }
    }

    beginLocalInteraction(targetX) {
        if (!this.artwork) {
            return null;
        }

        const fieldX = Math.max(
            0,
            targetX - this.parameters.carrierDistance / (2 * Math.PI)
        );

        return this.curtainField.beginLocalInteraction(fieldX);
    }

    updateLocalInteraction(interaction, horizontalDisplacement) {
        const visibleFactor = this.curtainField.applyLocalDisplacement(
            interaction,
            horizontalDisplacement,
            this.parameters.carrierDistance,
            this.parameters.minimumVisibleFactor,
            this.parameters.maximumVisibleFactor
        );

        this.render();

        return visibleFactor;
    }

    render() {
        if (!this.artwork) {
            return;
        }

        const parameters = this.curtainField.resolve(this.parameters);
        const phase = this.phaseResolver.resolve(parameters);
        const surface = this.surfaces[phase];
        const appearance = this.shading.appearanceFor();

        this.renderer.beginFrame(
            surface.frameFor(this.artwork, this.curtainField),
            appearance
        );
        let lastDestinationWidth = 1;

        for (let sourceX = 0; sourceX < this.artwork.width; sourceX += 1) {
            const column = this.artwork.columnAt(sourceX);
            const placement = surface.mapColumn(column, this.curtainField);
            const nextPlacement = sourceX + 1 < this.artwork.width
                ? surface.mapColumn(
                    this.artwork.columnAt(sourceX + 1),
                    this.curtainField
                )
                : null;
            const destinationWidth = nextPlacement
                && nextPlacement.branch === placement.branch
                ? nextPlacement.targetX - placement.targetX
                : lastDestinationWidth;
            const localParameters = this.curtainField.resolvedParametersAt(
                placement.periodIndex
            );
            const brightness = this.shading.factorFor(
                placement,
                localParameters
            );

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
                    localSlope: placement.localSlope,
                    foldProgress: localParameters.foldProgress
                }
            );
        }

        this.renderer.endFrame();
    }

    #configureCurtainField() {
        this.curtainField.configureFor(
            this.artwork.width,
            this.parameters.carrierDistance
        );
    }
}
