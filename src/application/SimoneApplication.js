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
        viewport,
        phaseResolver,
        surfaces,
        shading,
        renderer
    }) {
        this.artworkLoader = artworkLoader;
        this.parameters = parameters;
        this.curtainField = curtainField;
        this.viewport = viewport;
        this.viewportContentWidth = viewport.visibleWidth;
        this.viewportTargetOffset = 0;
        this.phaseResolver = phaseResolver;
        this.surfaces = surfaces;
        this.shading = shading;
        this.renderer = renderer;
        this.artwork = null;
        this.hasLoggedFrameDiagnostics = false;
    }

    async importArtwork(files) {
        const productionSegments = Array.isArray(files) ? files : [files];
        this.artwork = await this.artworkLoader(productionSegments);
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

    updateViewportPosition(position) {
        if (!this.artwork) {
            return;
        }

        this.viewport.setPosition(position, this.viewportContentWidth);
        this.render();
    }

    beginLocalInteraction(targetX) {
        if (!this.artwork) {
            return null;
        }

        const fieldX = Math.max(
            0,
            targetX
                + this.viewportTargetOffset
                - this.parameters.carrierDistance / (2 * Math.PI)
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
        const fullFrame = surface.frameFor(
            this.artwork,
            this.curtainField
        );
        const firstPlacement = surface.mapColumn(
            this.artwork.columnAt(0),
            this.curtainField
        );
        const lastSourceX = this.artwork.width - 1;
        const lastPlacement = surface.mapColumn(
            this.artwork.columnAt(lastSourceX),
            this.curtainField
        );
        const previousPlacement = lastSourceX > 0
            ? surface.mapColumn(
                this.artwork.columnAt(lastSourceX - 1),
                this.curtainField
            )
            : null;
        const finalColumnWidth = previousPlacement
            && previousPlacement.branch === lastPlacement.branch
            ? lastPlacement.targetX - previousPlacement.targetX
            : 1;

        this.viewportContentWidth = Math.max(
            this.viewport.visibleWidth,
            firstPlacement.targetX,
            lastPlacement.targetX + finalColumnWidth
        );
        this.viewport.constrainTo(this.viewportContentWidth);
        this.viewportTargetOffset = this.viewport.horizontalOffset;

        const viewportRight = this.viewport.horizontalOffset
            + this.viewport.visibleWidth;
        const visibleColumns = [];
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

            if (destinationWidth !== 0) {
                lastDestinationWidth = destinationWidth;
            }

            const columnLeft = Math.min(
                placement.targetX,
                placement.targetX + destinationWidth
            );
            const columnRight = Math.max(
                placement.targetX,
                placement.targetX + destinationWidth
            );

            if (columnRight <= this.viewport.horizontalOffset
                || columnLeft >= viewportRight) {
                continue;
            }

            const localParameters = this.curtainField.resolvedParametersAt(
                placement.periodIndex
            );
            const brightness = this.shading.factorFor(
                placement,
                localParameters
            );

            visibleColumns.push({
                column,
                placement,
                destinationWidth,
                brightness,
                foldProgress: localParameters.foldProgress
            });
        }

        const verticalScale = this.viewport.visibleHeight / fullFrame.height;

        this.renderer.beginFrame(
            {
                width: this.viewport.visibleWidth,
                height: this.viewport.visibleHeight
            },
            appearance
        );

        let minimumRenderedY = Infinity;
        let maximumRenderedY = -Infinity;

        for (const visibleColumn of visibleColumns) {
            const {
                column,
                placement,
                destinationWidth,
                brightness,
                foldProgress
            } = visibleColumn;
            const targetX = placement.targetX - this.viewportTargetOffset;
            const targetY = placement.targetY * verticalScale;
            const targetHeight = column.height * verticalScale;
            const roundedWidth = Math.round(targetX + destinationWidth)
                - Math.round(targetX);

            if (placement.alpha > 0 && roundedWidth !== 0) {
                minimumRenderedY = Math.min(minimumRenderedY, targetY);
                maximumRenderedY = Math.max(
                    maximumRenderedY,
                    targetY + targetHeight
                );
            }

            this.renderer.drawColumn(
                column,
                {
                    x: targetX,
                    y: targetY,
                    width: destinationWidth,
                    height: targetHeight
                },
                {
                    brightness,
                    alpha: placement.alpha,
                    branch: placement.branch,
                    localSlope: placement.localSlope,
                    foldProgress
                }
            );
        }

        this.renderer.endFrame();

        if (!this.hasLoggedFrameDiagnostics) {
            const display = this.renderer.displayMetrics();

            console.table({
                "browser window size": `${display.browserWidth} × ${display.browserHeight}`,
                "curtain-window size": `${display.curtainWindowWidth} × ${display.curtainWindowHeight}`,
                "canvas CSS display size": `${display.canvasCssWidth} × ${display.canvasCssHeight}`,
                "canvas backing-store size": `${display.canvasBackingWidth} × ${display.canvasBackingHeight}`,
                "Viewport width": this.viewport.visibleWidth,
                "Viewport height": this.viewport.visibleHeight,
                "CircularFoldSurface frame width": fullFrame.width,
                "CircularFoldSurface frame height": fullFrame.height,
                "verticalScale": verticalScale,
                "minimum rendered Y": Number.isFinite(minimumRenderedY)
                    ? minimumRenderedY
                    : null,
                "maximum rendered Y": Number.isFinite(maximumRenderedY)
                    ? maximumRenderedY
                    : null
            });
            this.hasLoggedFrameDiagnostics = true;
        }
    }

    #configureCurtainField() {
        this.curtainField.configureFor(
            this.artwork.width,
            this.parameters.carrierDistance
        );
    }
}
