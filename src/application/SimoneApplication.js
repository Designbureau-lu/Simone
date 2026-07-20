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
        renderer,
        performanceOverview = null
    }) {
        this.artworkLoader = artworkLoader;
        this.parameters = parameters;
        this.curtainField = curtainField;
        this.viewport = viewport;
        this.phaseResolver = phaseResolver;
        this.surfaces = surfaces;
        this.shading = shading;
        this.renderer = renderer;
        this.performanceOverview = performanceOverview;
        this.artwork = null;
        this.imageCount = 0;
        this.sceneVisibleFactor = curtainField.resetCurtainState;
    }

    async importArtwork(files) {
        this.artwork = await this.artworkLoader(files);
        this.imageCount = files.length;
        this.viewport.setProjectedWindow(0, 0);
        this.#configureCurtainField();
        this.render();
    }

    updateSurface(values) {
        const {
            resetCurtainState = this.curtainField.resetCurtainState,
            ...configuration
        } = values;

        this.parameters.configure(configuration);
        const constrainedResetCurtainState = this.parameters.resolve(
            resetCurtainState
        ).visibleFactor;
        this.curtainField.setResetCurtainState(
            constrainedResetCurtainState
        );
        this.sceneVisibleFactor = constrainedResetCurtainState;

        if (this.artwork) {
            this.#configureCurtainField();
            this.render();
        }
    }

    updateViewportPosition(position) {
        if (!this.artwork) {
            return;
        }

        this.viewport.setPosition(position);
        this.render();
    }

    beginLocalInteraction(targetX) {
        if (!this.artwork) {
            return null;
        }

        const projectedX = this.viewport.toProjectedX(targetX);
        const fieldX = Math.max(
            0,
            projectedX - this.parameters.carrierDistance / (2 * Math.PI)
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

        this.sceneVisibleFactor = visibleFactor;
        this.render();

        return visibleFactor;
    }

    render() {
        if (!this.artwork) {
            return;
        }

        const frameStartedAt = performance.now();
        const curtainFieldStartedAt = performance.now();
        const parameters = this.curtainField.resolve(this.parameters);
        const curtainFieldTime = performance.now() - curtainFieldStartedAt;

        const geometryStartedAt = performance.now();
        const phase = this.phaseResolver.resolve(parameters);
        const surface = this.surfaces[phase];
        const appearance = this.shading.appearanceFor();

        const contentFrame = surface.frameFor(
            this.artwork,
            this.curtainField
        );
        const projectedColumns = this.#projectGeometry(surface);
        this.viewport.presentationExtent = contentFrame.width;
        const contentBounds = boundsFor(
            projectedColumns,
            0,
            projectedColumns.length
        );

        if (this.viewport.projectedExtent === 0) {
            this.viewport.setProjectedWindow(
                contentBounds.start,
                INITIAL_PROJECTED_EXTENT
            );
        }

        this.viewport.setProjectedContentRange(
            contentBounds.start,
            contentBounds.end
        );
        const geometryTime = performance.now() - geometryStartedAt;

        const renderingStartedAt = performance.now();
        this.renderer.beginFrame(contentFrame, appearance);
        const viewportStartedAt = performance.now();
        const artworkRange = this.viewport.sourceRangeFor(projectedColumns);
        const viewportTime = performance.now() - viewportStartedAt;

        for (
            let sourceX = artworkRange.start;
            sourceX < artworkRange.end;
            sourceX += 1
        ) {
            const column = this.artwork.columnAt(sourceX);
            const projectedColumn = projectedColumns[sourceX];
            const placement = projectedColumn.placement;
            const destinationWidth = this.viewport.presentationWidthBetween(
                placement.targetX,
                placement.targetX + projectedColumn.width
            );
            const localParameters = this.curtainField.resolvedParametersAt(
                placement.periodIndex
            );
            const brightness = this.shading.factorFor(
                placement,
                localParameters
            );

            this.renderer.drawColumn(
                column,
                {
                    x: this.viewport.toPresentationX(placement.targetX),
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

        const renderingTime = performance.now() - renderingStartedAt
            - viewportTime;

        const overlayStartedAt = performance.now();
        const rendererMetrics = this.renderer.endFrame();
        const overlayTime = performance.now() - overlayStartedAt;
        const totalTime = performance.now() - frameStartedAt;

        this.performanceOverview?.update({
            totalTime,
            curtainFieldTime,
            geometryTime,
            viewportTime,
            renderingTime,
            overlayTime,
            totalColumns: this.artwork.width,
            visibleColumns: artworkRange.end - artworkRange.start,
            periodCount: this.curtainField.periods.length,
            projectedExtent: this.viewport.projectedExtent,
            imageCount: this.imageCount,
            visibleFactor: this.sceneVisibleFactor,
            carrierDistance: this.parameters.carrierDistance,
            ...rendererMetrics
        });
    }

    #projectGeometry(surface) {
        const placements = new Array(this.artwork.width);

        for (let sourceX = 0; sourceX < this.artwork.width; sourceX += 1) {
            const column = this.artwork.columnAt(sourceX);
            placements[sourceX] = surface.mapColumn(
                column,
                this.curtainField
            );
        }

        const projectedColumns = new Array(placements.length);
        let lastWidth = 1;

        for (let sourceX = 0; sourceX < placements.length; sourceX += 1) {
            const placement = placements[sourceX];
            const nextPlacement = placements[sourceX + 1];
            const width = nextPlacement
                && nextPlacement.branch === placement.branch
                ? nextPlacement.targetX - placement.targetX
                : lastWidth;

            if (width !== 0) {
                lastWidth = width;
            }

            projectedColumns[sourceX] = Object.freeze({ placement, width });
        }

        return projectedColumns;
    }

    #configureCurtainField() {
        this.curtainField.configureFor(
            this.artwork.width,
            this.parameters.carrierDistance
        );
    }
}

const INITIAL_PROJECTED_EXTENT = 5000;

function boundsFor(projectedColumns, start, end) {
    let minimum = Infinity;
    let maximum = -Infinity;

    for (let sourceX = start; sourceX < end; sourceX += 1) {
        const { placement, width } = projectedColumns[sourceX];
        minimum = Math.min(
            minimum,
            placement.targetX,
            placement.targetX + width
        );
        maximum = Math.max(
            maximum,
            placement.targetX,
            placement.targetX + width
        );
    }

    if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) {
        throw new RangeError("Projected geometry has no visible bounds.");
    }

    return Object.freeze({ start: minimum, end: maximum });
}
