import { SimoneApplication } from "../../application/SimoneApplication.js";

/** Temporary Model C proof of concept: virtual geometry, viewing-space output. */
export class ModelCApplication extends SimoneApplication {
    constructor({ viewingSurface, ...dependencies }) {
        super(dependencies);
        this.viewingSurface = viewingSurface;
    }

    interactionDisplacementScale(displayWidth) {
        return this.viewport.projectedExtent > 0
            ? this.viewport.projectedExtent / displayWidth
            : 1;
    }

    setDestinationMode(mode) {
        this.viewingSurface.mode = mode;
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
        const virtualFrame = surface.frameFor(
            this.artwork,
            this.curtainField
        );
        const projectedColumns = this.#projectGeometry(surface);
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

        const viewing = this.viewingSurface.resolve(virtualFrame);
        this.viewport.presentationExtent = viewing.frame.width;
        const viewingAppearance = this.viewingSurface.appearanceFor(
            appearance,
            viewing.scaleX
        );
        const geometryTime = performance.now() - geometryStartedAt;

        const selectionStartedAt = performance.now();
        const artworkRange = this.viewport.sourceRangeFor(projectedColumns);
        const viewportTime = performance.now() - selectionStartedAt;

        const canvasResetStartedAt = performance.now();
        this.renderer.beginFrame(viewing.frame, viewingAppearance);
        const canvasResetTime = performance.now() - canvasResetStartedAt;

        const renderingStartedAt = performance.now();
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
                    y: placement.targetY * viewing.scaleY,
                    width: destinationWidth,
                    height: column.height * viewing.scaleY
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
        const renderingTime = performance.now() - renderingStartedAt;

        const shadingStartedAt = performance.now();
        const rendererMetrics = this.renderer.endFrame();
        const overlayTime = performance.now() - shadingStartedAt;
        const totalTime = performance.now() - frameStartedAt;

        const report = Object.freeze({
            totalTime,
            curtainFieldTime,
            geometryTime,
            viewportTime,
            renderingTime,
            overlayTime,
            canvasResetTime,
            totalColumns: this.artwork.width,
            visibleColumns: artworkRange.end - artworkRange.start,
            periodCount: this.curtainField.periods.length,
            projectedExtent: this.viewport.projectedExtent,
            imageCount: this.imageCount,
            visibleFactor: this.sceneVisibleFactor,
            carrierDistance: this.parameters.carrierDistance,
            destinationPixelCount: viewing.frame.width * viewing.frame.height,
            pixelRatio: viewing.pixelRatio,
            destinationMode: viewing.mode,
            ...rendererMetrics
        });
        this.performanceOverview?.update(report);
        return report;
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
}

const INITIAL_PROJECTED_EXTENT = 5000;

function boundsFor(projectedColumns, start, end) {
    let minimum = Infinity;
    let maximum = -Infinity;

    for (let sourceX = start; sourceX < end; sourceX += 1) {
        const { placement, width } = projectedColumns[sourceX];
        minimum = Math.min(minimum, placement.targetX, placement.targetX + width);
        maximum = Math.max(maximum, placement.targetX, placement.targetX + width);
    }

    if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) {
        throw new RangeError("Projected geometry has no visible bounds.");
    }

    return Object.freeze({ start: minimum, end: maximum });
}
