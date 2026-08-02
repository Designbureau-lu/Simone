import { SimoneApplication } from "./SimoneApplication.js";
import {
    SegmentPriority
} from "../artwork/ArtworkSegmentScheduler.js";
import {
    depthAnchoredTop,
    depthScaledHeight
} from "../rendering/DepthHeightProjection.js";

const VIEWPORT_SAMPLING_GUARD_PERIODS = 4;

/** SIMONE application using virtual geometry and viewing-space output. */
export class ViewportApplication extends SimoneApplication {
    #logicalSourceXs = null;
    #logicalSourceArtwork = null;
    #logicalSourceImageWidth = null;
    #currentSurface = null;
    #sampledSourceRange = null;
    #artworkSegmentScheduler = null;

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

    setArtworkSegmentScheduler(scheduler) {
        this.#artworkSegmentScheduler = scheduler;
    }

    startBackgroundArtworkLoading() {
        if (!this.#artworkSegmentScheduler || !this.artwork) {
            return;
        }
        this.#artworkSegmentScheduler.request(
            this.#segmentsOutwardFromCurrentViewport(),
            SegmentPriority.BACKGROUND
        );
        this.prioritizeArtworkForIdle();
    }

    prioritizeArtworkForPan(cameraDisplacement) {
        if (!this.#artworkSegmentScheduler
            || !Number.isFinite(cameraDisplacement)
            || cameraDisplacement === 0) {
            return;
        }
        const corridor = panPriorityCorridor(
            this.viewport.projectedOffset,
            this.viewport.projectedExtent,
            cameraDisplacement
        );
        this.#reprioritizeArtwork([
            {
                indices: this.requiredSegmentIndicesForCurrentViewport(),
                priority: SegmentPriority.VISIBLE
            },
            {
                indices: this.#segmentIndicesForProjectedWindow(
                    corridor.start,
                    corridor.end
                ),
                priority: SegmentPriority.MOVEMENT_AHEAD
            }
        ]);
    }

    prioritizeArtworkForInertia(
        viewportVelocity,
        inertiaGain,
        inertiaDamping
    ) {
        if (!this.#artworkSegmentScheduler
            || !Number.isFinite(viewportVelocity)
            || viewportVelocity === 0) {
            return;
        }
        const predictedTravel = predictedInertialCameraTravel(
            viewportVelocity,
            inertiaGain,
            inertiaDamping
        );
        if (predictedTravel === 0) {
            this.prioritizeArtworkForIdle();
            return;
        }
        const direction = Math.sign(predictedTravel);
        const corridor = inertiaPriorityCorridor(
            this.viewport.projectedOffset,
            this.viewport.projectedExtent,
            predictedTravel,
            this.viewport.availableProjectedDisplacement(direction)
        );
        this.#reprioritizeArtwork([
            {
                indices: this.requiredSegmentIndicesForCurrentViewport(),
                priority: SegmentPriority.VISIBLE
            },
            {
                indices: this.#segmentIndicesForProjectedWindow(
                    corridor.start,
                    corridor.end
                ),
                priority: SegmentPriority.MOVEMENT_AHEAD
            }
        ]);
    }

    prioritizeArtworkForDestination(projectedOffset) {
        if (!this.#artworkSegmentScheduler
            || !Number.isFinite(projectedOffset)) {
            return;
        }
        this.#reprioritizeArtwork([
            {
                indices: this.requiredSegmentIndicesForCurrentViewport(),
                priority: SegmentPriority.VISIBLE
            },
            {
                indices: this.#segmentIndicesForProjectedWindow(
                    projectedOffset,
                    projectedOffset + this.viewport.projectedExtent
                ),
                priority: SegmentPriority.DESTINATION
            }
        ]);
    }

    prioritizeArtworkForIdle() {
        if (!this.#artworkSegmentScheduler || !this.artwork) {
            return;
        }
        const visible = this.requiredSegmentIndicesForCurrentViewport();
        const groups = [{
            indices: visible,
            priority: SegmentPriority.VISIBLE
        }];
        this.#segmentsOutwardFromCurrentViewport().forEach((index, order) => {
            groups.push({
                indices: [index],
                priority: SegmentPriority.IDLE_NEARBY - order
            });
        });
        this.#reprioritizeArtwork(groups);
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
        this.#currentSurface = surface;
        const appearance = this.shading.appearanceFor();
        const periodGeometryStartedAt = performance.now();
        const virtualFrame = surface.frameFor(
            {
                width: this.logicalArtworkWidth,
                height: this.artwork.height
            },
            this.curtainField
        );
        const periodGeometryTime = performance.now()
            - periodGeometryStartedAt;
        const viewportDiscoveryStartedAt = performance.now();
        const contentBounds = this.#projectedContentBounds(surface);
        this.projectedContentBounds = contentBounds;
        const viewing = this.viewingSurface.resolve(
            virtualFrame,
            this.artwork.height
        );

        const previousExtent = this.viewport.projectedExtent;
        const projectedExtent = viewing.projectedExtent ?? previousExtent;
        const projectedOffset = previousExtent === 0
            ? contentBounds.start
            : this.viewport.projectedOffset
                + (previousExtent - projectedExtent) / 2;
        this.viewport.setProjectedWindow(
            Math.max(contentBounds.start, projectedOffset),
            projectedExtent
        );

        this.viewport.setProjectedContentRange(
            contentBounds.start,
            contentBounds.end
        );

        this.viewport.presentationExtent = viewing.frame.width;
        const viewingAppearance = this.viewingSurface.appearanceFor(
            appearance,
            viewing.scaleX
        );
        const periodSamplingRange = surface.samplingRangeForProjectedWindow(
            this.viewport.projectedOffset,
            this.viewport.projectedOffset + this.viewport.projectedExtent,
            VIEWPORT_SAMPLING_GUARD_PERIODS
        );
        const sampledSourceRange = this.#sourceRangeForSampling(
            periodSamplingRange
        );
        this.#sampledSourceRange = sampledSourceRange;
        const viewportDiscoveryTime = performance.now()
            - viewportDiscoveryStartedAt;
        const columnProjectionStartedAt = performance.now();
        const sampledProjectedColumns = this.#projectSampledGeometry(
            surface,
            sampledSourceRange.start,
            sampledSourceRange.end
        );
        this.projectedColumns = Object.freeze(sampledProjectedColumns);
        const columnProjectionTime = performance.now()
            - columnProjectionStartedAt;
        const geometryTime = performance.now() - geometryStartedAt;

        const selectionStartedAt = performance.now();
        const artworkRange = this.viewport.sourceRangeFor(
            sampledProjectedColumns,
            sampledSourceRange
        );
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
            if (!column) {
                continue;
            }
            const projectedColumn = sampledProjectedColumns[sourceX];
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
            const destinationHeight = depthScaledHeight(
                column.height,
                placement.depthFromFront,
                placement.referenceMaximumDepth,
                viewing.scaleY
            );

            this.renderer.drawColumn(
                column,
                {
                    x: this.viewport.toPresentationX(placement.targetX),
                    y: depthAnchoredTop(
                        column.height,
                        placement.targetY,
                        destinationHeight,
                        viewing.scaleY
                    ),
                    width: destinationWidth,
                    height: destinationHeight
                },
                {
                    brightness,
                    alpha: placement.alpha,
                    branch: placement.branch,
                    localSlope: placement.localSlope,
                    foldProgress: localParameters.foldProgress,
                    crestLifecycleMultiplier:
                        this.shading.crestLifecycleFor(localParameters)
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
            periodGeometryTime,
            viewportDiscoveryTime,
            columnProjectionTime,
            viewportTime,
            renderingTime,
            overlayTime,
            canvasResetTime,
            totalColumns: this.artwork.width,
            visibleColumns: artworkRange.end - artworkRange.start,
            projectedColumns:
                sampledSourceRange.end - sampledSourceRange.start,
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

    requiredSegmentIndicesForCurrentViewport() {
        if (!this.artwork || !this.#sampledSourceRange) {
            return Object.freeze([]);
        }
        return this.artwork.segmentIndicesForSourceRange(
            this.#sampledSourceRange.start,
            this.#sampledSourceRange.end
        );
    }

    segmentIntersectsCurrentViewport(index) {
        return this.requiredSegmentIndicesForCurrentViewport().includes(index);
    }

    #segmentIndicesForProjectedWindow(start, end) {
        if (!this.artwork || !this.#currentSurface) {
            return Object.freeze([]);
        }
        const range = this.#currentSurface.samplingRangeForProjectedWindow(
            start,
            end,
            VIEWPORT_SAMPLING_GUARD_PERIODS
        );
        const sourceRange = this.#sourceRangeForSampling(range);
        return this.artwork.segmentIndicesForSourceRange(
            sourceRange.start,
            sourceRange.end
        );
    }

    #segmentsOutwardFromCurrentViewport() {
        const visible = this.requiredSegmentIndicesForCurrentViewport();
        const first = visible[0] ?? 0;
        const last = visible.at(-1) ?? first;
        return Array.from({ length: this.artwork.imageCount }, (_, index) => (
            index
        )).sort((firstIndex, secondIndex) => (
            distanceFromRange(firstIndex, first, last)
                - distanceFromRange(secondIndex, first, last)
            || firstIndex - secondIndex
        ));
    }

    #reprioritizeArtwork(groups) {
        this.#artworkSegmentScheduler?.reprioritize(groups);
    }

    projectedColumnAt(sourceX) {
        const existing = super.projectedColumnAt(sourceX);
        if (existing || !this.#currentSurface || !this.artwork) {
            return existing;
        }

        const placement = this.#placementAt(this.#currentSurface, sourceX);
        const nextPlacement = sourceX + 1 < this.artwork.width
            ? this.#placementAt(this.#currentSurface, sourceX + 1)
            : null;
        const width = nextPlacement
            && nextPlacement.branch === placement.branch
            ? nextPlacement.targetX - placement.targetX
            : 1;

        return Object.freeze({ placement, width });
    }

    #projectSampledGeometry(surface, start, end) {
        const placements = new Array(this.artwork.width);

        for (let sourceX = start; sourceX < end; sourceX += 1) {
            placements[sourceX] = this.#placementAt(surface, sourceX);
        }

        const projectedColumns = new Array(placements.length);
        let lastWidth = 1;

        for (let sourceX = start; sourceX < end; sourceX += 1) {
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

    #placementAt(surface, sourceX) {
        const logicalSourceXs = this.#logicalSourceXsForArtwork();
        return surface.mapColumn(
            { sourceX: logicalSourceXs[sourceX] },
            this.curtainField
        );
    }

    #sourceRangeForSampling(periodSamplingRange) {
        if (periodSamplingRange.periodEnd
            === periodSamplingRange.periodStart) {
            return Object.freeze({ start: 0, end: 0 });
        }

        const logicalStart = Math.min(
            periodSamplingRange.logicalStart,
            this.logicalArtworkWidth
        );
        const logicalEnd = Math.min(
            periodSamplingRange.logicalEnd,
            this.logicalArtworkWidth
        );
        const start = this.artwork.sourceXForLogicalX(
            logicalStart,
            this.logicalImageWidth
        );
        const end = logicalEnd === this.logicalArtworkWidth
            ? this.artwork.width
            : this.artwork.sourceXForLogicalX(
                logicalEnd,
                this.logicalImageWidth
            );

        return Object.freeze({
            start: Math.max(0, start - 1),
            end: Math.min(this.artwork.width, end + 1)
        });
    }

    #projectedContentBounds(surface) {
        const first = this.#placementAt(surface, 0);
        const second = this.artwork.width > 1
            ? this.#placementAt(surface, 1)
            : null;
        const firstWidth = second && second.branch === first.branch
            ? second.targetX - first.targetX
            : 1;
        const lastSourceX = this.artwork.width - 1;
        const last = this.#placementAt(surface, lastSourceX);
        let lastWidth = 1;
        let current = last;

        for (
            let sourceX = lastSourceX - 1;
            sourceX >= 0;
            sourceX -= 1
        ) {
            const previous = this.#placementAt(surface, sourceX);
            const width = current.branch === previous.branch
                ? current.targetX - previous.targetX
                : 0;
            if (width !== 0) {
                lastWidth = width;
                break;
            }
            current = previous;
        }

        return Object.freeze({
            start: Math.min(first.targetX, first.targetX + firstWidth),
            end: Math.max(last.targetX, last.targetX + lastWidth)
        });
    }

    #logicalSourceXsForArtwork() {
        if (this.#logicalSourceArtwork === this.artwork
            && this.#logicalSourceImageWidth === this.logicalImageWidth) {
            return this.#logicalSourceXs;
        }

        const logicalSourceXs = new Float64Array(this.artwork.width);
        for (let sourceX = 0; sourceX < this.artwork.width; sourceX += 1) {
            logicalSourceXs[sourceX] = this.artwork.logicalXForSourceX(
                sourceX,
                this.logicalImageWidth
            );
        }
        this.#logicalSourceXs = logicalSourceXs;
        this.#logicalSourceArtwork = this.artwork;
        this.#logicalSourceImageWidth = this.logicalImageWidth;
        return logicalSourceXs;
    }
}

export function predictedInertialCameraTravel(
    viewportVelocity,
    inertiaGain,
    inertiaDamping
) {
    if (!Number.isFinite(viewportVelocity)
        || !Number.isFinite(inertiaGain)
        || inertiaGain < 0
        || !Number.isFinite(inertiaDamping)
        || inertiaDamping <= 0) {
        throw new RangeError("Viewport inertia prediction is invalid.");
    }
    return -viewportVelocity * inertiaGain * 1000 / inertiaDamping;
}

export function panPriorityCorridor(offset, extent, cameraDisplacement) {
    return Object.freeze(cameraDisplacement > 0
        ? { start: offset, end: offset + 2 * extent }
        : { start: offset - extent, end: offset + extent });
}

export function inertiaPriorityCorridor(
    offset,
    extent,
    predictedTravel,
    availableTravel
) {
    const direction = Math.sign(predictedTravel);
    const travel = direction * Math.min(
        Math.abs(predictedTravel),
        availableTravel
    );
    const target = offset + travel;
    return Object.freeze({
        start: Math.min(offset, target),
        end: Math.max(offset + extent, target + extent)
    });
}

function distanceFromRange(index, start, end) {
    if (index < start) {
        return start - index;
    }
    if (index > end) {
        return index - end;
    }
    return 0;
}
