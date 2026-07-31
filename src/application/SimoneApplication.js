import {
    artworkLayout,
    resolveArtworkLayout
} from "../navigation/ArtworkLayout.js";

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
        this.attentionMode = ATTENTION_MODE_EXPLORE;
        this.projectNavigation = null;
        this.currentProjectIndex = null;
        this.projectedColumns = Object.freeze([]);
        this.projectedContentBounds = null;
        this.imageCount = 0;
        this.logicalArtworkWidth = 0;
        this.logicalImageWidth = 0;
        this.sceneVisibleFactor = curtainField.resetCurtainState;
        this.horizontalReframeFrame = null;
        this.resetCurtainFrame = null;
        this.localRevealFrame = null;
        this.localRevealState = null;
        this.touchExplorationFrame = null;
        this.touchExplorationState = null;
    }

    async importArtwork(files) {
        this.attentionMode = ATTENTION_MODE_EXPLORE;
        this.projectNavigation = null;
        this.currentProjectIndex = null;
        this.artwork = await this.artworkLoader(files);
        this.imageCount = this.artwork.imageCount;
        const layout = resolveArtworkLayout(artworkLayout);
        this.logicalImageWidth = layout.repetitionsPerImage * layout.unitWidth;
        this.logicalArtworkWidth = this.imageCount * this.logicalImageWidth;
        this.viewport.setProjectedWindow(0, 0);
        this.#configureCurtainField();
        this.render();
    }

    setProjectNavigation(projectNavigation) {
        this.projectNavigation = projectNavigation;
        this.currentProjectIndex = projectNavigation?.enabled
            && projectNavigation.projects.length > 0
            ? 0
            : null;
    }

    updateSurface(values) {
        this.cancelTouchExplorationResponse();
        this.cancelLocalReveal();
        this.cancelResetCurtainAnimation();
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

    animateResetCurtainState(
        values,
        onFrame = null,
        onComplete = null
    ) {
        const {
            resetCurtainState = this.curtainField.resetCurtainState,
            ...configuration
        } = values;

        this.cancelTouchExplorationResponse();
        this.cancelLocalReveal();
        this.cancelHorizontalReframe();
        this.cancelResetCurtainAnimation();
        this.parameters.configure(configuration);
        const target = this.parameters.resolve(
            resetCurtainState
        ).visibleFactor;
        this.curtainField.setResetCurtainStateTarget(target);

        if (!this.artwork || this.curtainField.periods.length === 0) {
            this.curtainField.setResetCurtainState(target);
            this.sceneVisibleFactor = target;
            return false;
        }

        const startingFactors = Object.freeze(
            this.curtainField.periods.map((period) => period.visibleFactor)
        );
        const startingSceneFactor = this.sceneVisibleFactor;
        let startedAt = null;
        const reset = (timestamp) => {
            startedAt ??= timestamp;
            const progress = Math.min(
                (timestamp - startedAt) / RESET_CURTAIN_DURATION,
                1
            );
            const easedProgress = resetEaseOut(progress);

            if (progress < 1) {
                this.curtainField.setVisibleFactors(
                    startingFactors.map((value) => (
                        value + (target - value) * easedProgress
                    ))
                );
                this.sceneVisibleFactor = startingSceneFactor
                    + (target - startingSceneFactor) * easedProgress;
            } else {
                this.curtainField.setResetCurtainState(target);
                this.sceneVisibleFactor = target;
            }

            this.render();
            onFrame?.();

            if (progress < 1) {
                this.resetCurtainFrame = requestAnimationFrame(reset);
            } else {
                this.resetCurtainFrame = null;
                onComplete?.();
            }
        };

        this.resetCurtainFrame = requestAnimationFrame(reset);
        return true;
    }

    cancelResetCurtainAnimation() {
        if (this.resetCurtainFrame === null) {
            return;
        }

        cancelAnimationFrame(this.resetCurtainFrame);
        this.resetCurtainFrame = null;
    }

    updateViewportPosition(position) {
        if (!this.artwork) {
            return;
        }

        this.cancelTouchExplorationResponse();
        this.cancelHorizontalReframe();
        this.viewport.setPosition(position);
        this.render();
    }

    reframeHorizontal(direction, interaction, onFrame = null) {
        if (!this.artwork || (direction !== -1 && direction !== 1)) {
            return false;
        }

        this.cancelHorizontalReframe();
        const startOffset = this.viewport.projectedOffset;
        const projectedExtent = this.viewport.projectedExtent;
        const grabbedProjectedX = this.curtainField
            .projectedXForInteraction(interaction)
            + this.parameters.carrierDistance / (2 * Math.PI);
        const grabbedScreenPositionBefore = (
            grabbedProjectedX - startOffset
        ) / projectedExtent;
        const originalRequestedDistance = projectedExtent
            * HORIZONTAL_REFRAME_DISTANCE_FACTOR;
        // The grabbed-point limit may later include a configurable safety inset
        // after further user testing. Current inset intentionally equals zero.
        const twoPeriodInset = 0;
        const maximumGrabbedPointDistance = Math.max(
            0,
            (direction > 0
                ? grabbedProjectedX - startOffset
                : startOffset + projectedExtent - grabbedProjectedX)
                - twoPeriodInset
        );
        const viewportContentBoundLimit = this.viewport
            .availableProjectedDisplacement(direction);
        const appliedDistance = Math.max(
            0,
            Math.min(
                originalRequestedDistance,
                maximumGrabbedPointDistance,
                viewportContentBoundLimit
            )
        );
        const targetOffset = startOffset + direction * appliedDistance;
        const displacement = targetOffset - startOffset;

        if (displacement === 0) {
            onFrame?.();
            return false;
        }

        const grabbedScreenPositionAfter = (
            grabbedProjectedX - targetOffset
        ) / projectedExtent;
        console.info("Invisible Reframing distance", {
            grabbedPointScreenPositionBefore: grabbedScreenPositionBefore,
            originalRequestedDistance,
            maximumDistanceAllowedByGrabbedPoint:
                maximumGrabbedPointDistance,
            twoPeriodInset,
            viewportContentBoundLimit,
            finalAppliedDistance: appliedDistance,
            grabbedPointScreenPositionAfter: grabbedScreenPositionAfter
        });

        return this.animateViewportToProjectedOffset(targetOffset, onFrame);
    }

    navigateToNextProject(onFrame = null) {
        return this.navigateToProject(
            this.currentProjectIndex === null
                ? null
                : this.currentProjectIndex + 1,
            onFrame
        );
    }

    navigateToPreviousProject(onFrame = null) {
        return this.navigateToProject(
            this.currentProjectIndex === null
                ? null
                : this.currentProjectIndex - 1,
            onFrame
        );
    }

    navigateToProject(
        targetIndex,
        onFrame = null,
        openingMode = PROJECT_OPENING_PROTOTYPE
    ) {
        if (!this.projectNavigation?.enabled
            || this.currentProjectIndex === null
            || targetIndex === null
            || targetIndex < 0
            || targetIndex >= this.projectNavigation.projects.length) {
            return false;
        }

        if (targetIndex === this.currentProjectIndex
            && openingMode !== PROJECT_OPENING_FLAT_SPAN) {
            return false;
        }

        this.cancelTouchExplorationResponse();
        this.cancelResetCurtainAnimation();
        const project = this.projectNavigation.projects[targetIndex];
        const projection = this.projectProjectionFor(project);
        if (!projection) {
            console.error(
                `Project "${project.title}" begins outside loaded artwork.`
            );
            return false;
        }

        console.info("SIMONE semantic project projection", {
            project: project.title,
            ...projection
        });

        this.attentionMode = ATTENTION_MODE_READ;
        const targetOffset = openingMode === PROJECT_OPENING_FLAT_SPAN
            ? projection.requestedCenteredTarget
            : projection.requestedNextTarget;
        this.animateViewportToProjectedOffset(
            targetOffset,
            onFrame,
            () => openingMode === PROJECT_OPENING_FLAT_SPAN
                ? this.#applyFlatSemanticProjectOpen()
                : this.#applySemanticAutoOpen()
        );
        this.currentProjectIndex = targetIndex;

        return true;
    }

    resetAndNavigateToProject(
        targetIndex,
        onFrame = null,
        onSelection = null
    ) {
        this.attentionMode = ATTENTION_MODE_READ;
        return this.animateResetCurtainState(
            {
                resetCurtainState: READ_ENTRY_RESET_STATE
            },
            null,
            () => {
                this.navigateToProject(
                    targetIndex,
                    onFrame,
                    PROJECT_OPENING_FLAT_SPAN
                );
                onSelection?.();
            }
        );
    }

    projectProjectionFor(project) {
        const logicalArtworkWidth = this.logicalArtworkWidth;
        const actualAssembledArtworkWidth = this.artwork.width;
        const sourceX = this.artwork.sourceXForLogicalX(
            project.artworkStart,
            this.logicalImageWidth
        );
        const scaleFactor = actualAssembledArtworkWidth
            / logicalArtworkWidth;
        const projectedColumn = this.projectedColumnAt(sourceX);
        if (!projectedColumn) {
            return null;
        }

        const requestedNextTarget = projectedColumn.placement.targetX;
        const semanticCenter = (
            project.artworkStart + project.artworkEnd
        ) / 2;
        const centerSourceX = Number.isFinite(semanticCenter)
            ? this.artwork.sourceXForLogicalX(
                semanticCenter,
                this.logicalImageWidth
            )
            : null;
        const centerProjectedColumn = centerSourceX === null
            ? null
            : this.projectedColumnAt(centerSourceX);
        const requestedCenteredTarget = centerProjectedColumn
            ? centerProjectedColumn.placement.targetX
                - this.viewport.projectedExtent / 2
                + READ_CENTER_OFFSET
            : requestedNextTarget;
        const renderedArtworkWidth = this.projectedContentBounds.end
            - this.projectedContentBounds.start;
        const viewportBounds = this.viewport.movementBounds;
        const clampedNextTarget = this.viewport.projectedOffsetAfterShift(
            requestedNextTarget - this.viewport.projectedOffset
        );

        return Object.freeze({
            logicalArtworkWidth,
            actualAssembledArtworkWidth,
            renderedArtworkWidth,
            projectArtworkStart: project.artworkStart,
            scaleFactor,
            sourceX,
            requestedNextTarget,
            requestedCenteredTarget,
            clampedNextTarget,
            viewportWidth: this.viewport.projectedExtent,
            viewportPosition: this.viewport.projectedOffset,
            viewportNormalizedPosition: this.viewport.position,
            minimumViewportPosition: viewportBounds.minimum,
            maximumViewportPosition: viewportBounds.maximum,
            loadedImageCount: this.imageCount,
            artworkWidth: this.artwork.width
        });
    }

    animateViewportToProjectedOffset(
        targetOffset,
        onFrame = null,
        onComplete = null
    ) {
        if (!this.artwork || !Number.isFinite(targetOffset)) {
            return false;
        }

        this.cancelHorizontalReframe();
        const startOffset = this.viewport.projectedOffset;
        const boundedTargetOffset = this.viewport.projectedOffsetAfterShift(
            targetOffset - startOffset
        );
        const displacement = boundedTargetOffset - startOffset;

        if (displacement === 0) {
            onFrame?.();
            return false;
        }

        let startedAt = null;
        const settle = (timestamp) => {
            startedAt ??= timestamp;
            const progress = Math.min(
                (timestamp - startedAt) / HORIZONTAL_REFRAME_DURATION,
                1
            );
            const desiredOffset = startOffset
                + displacement * smoothstep(progress);

            this.viewport.shiftProjectedOffset(
                desiredOffset - this.viewport.projectedOffset
            );
            this.render();
            onFrame?.();

            if (progress < 1) {
                this.horizontalReframeFrame = requestAnimationFrame(settle);
            } else {
                this.horizontalReframeFrame = null;
                onComplete?.();
            }
        };

        this.horizontalReframeFrame = requestAnimationFrame(settle);
        return true;
    }

    cancelHorizontalReframe() {
        if (this.horizontalReframeFrame === null) {
            return;
        }

        cancelAnimationFrame(this.horizontalReframeFrame);
        this.horizontalReframeFrame = null;
    }

    beginLocalInteraction(targetX) {
        if (!this.artwork) {
            return null;
        }

        this.enterExploreMode();
        this.cancelTouchExplorationResponse();
        this.cancelLocalReveal();
        this.cancelHorizontalReframe();
        this.cancelResetCurtainAnimation();
        const projectedX = this.viewport.toProjectedX(targetX);
        const fieldX = Math.max(
            0,
            projectedX - this.parameters.carrierDistance / (2 * Math.PI)
        );

        return this.curtainField.beginLocalInteraction(fieldX);
    }

    beginTouchExploration(targetX) {
        return this.beginLocalInteraction(targetX);
    }

    beginTouchPinch(midpointTargetX) {
        return this.beginLocalInteraction(midpointTargetX);
    }

    updateTouchPinch(
        interaction,
        midpointTargetX,
        halfSeparationDisplacement
    ) {
        if (!interaction
            || !Number.isFinite(midpointTargetX)
            || !Number.isFinite(halfSeparationDisplacement)) {
            return false;
        }

        const projectedMidpoint = this.viewport.toProjectedX(midpointTargetX);
        const fieldMidpoint = Math.max(
            0,
            projectedMidpoint
                - this.parameters.carrierDistance / (2 * Math.PI)
        );
        const halfSpan = Math.abs(halfSeparationDisplacement);

        this.sceneVisibleFactor = this.curtainField.applyPinchDisplacement(
            interaction,
            Math.max(0, fieldMidpoint - halfSpan),
            -halfSeparationDisplacement,
            fieldMidpoint + halfSpan,
            halfSeparationDisplacement,
            this.parameters.carrierDistance,
            this.parameters.minimumVisibleFactor,
            this.parameters.maximumVisibleFactor
        );
        this.curtainField.resolve(this.parameters);
        this.render();
        return this.sceneVisibleFactor;
    }

    enterExploreMode() {
        this.attentionMode = ATTENTION_MODE_EXPLORE;
    }

    projectAtPresentationX(targetX) {
        if (!this.artwork || !this.projectNavigation?.enabled) {
            return null;
        }

        const projectedX = this.viewport.toProjectedX(targetX);
        let sourceX = null;
        for (let index = 0; index < this.projectedColumns.length; index += 1) {
            const column = this.projectedColumns[index];
            if (!column) {
                continue;
            }

            const start = Math.min(
                column.placement.targetX,
                column.placement.targetX + column.width
            );
            const end = Math.max(
                column.placement.targetX,
                column.placement.targetX + column.width
            );
            if (projectedX >= start && projectedX < end) {
                sourceX = index;
            }
        }
        if (sourceX === null) {
            return null;
        }

        return this.projectNavigation.projects.find((project) => {
            const start = this.artwork.sourceXForLogicalX(
                project.artworkStart,
                this.logicalImageWidth
            );
            const end = this.artwork.sourceXForLogicalX(
                project.artworkEnd,
                this.logicalImageWidth
            );
            return sourceX >= start && sourceX < end;
        }) ?? null;
    }

    projectedColumnAt(sourceX) {
        return this.projectedColumns[sourceX] ?? null;
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

    updateTouchExploration(
        interaction,
        fingerDisplacement,
        temporaryReveal,
        temporaryDirectionalBias,
        retainedVisibleFactors = null,
        retainedDevelopment = 0
    ) {
        if (!interaction
            || !Number.isFinite(fingerDisplacement)
            || !Number.isFinite(temporaryReveal)
            || !Number.isFinite(temporaryDirectionalBias)
            || !Number.isFinite(retainedDevelopment)
            || retainedDevelopment < 0
            || retainedDevelopment > 1) {
            return false;
        }

        const previousAnchor = this.curtainField
            .projectedXForInteraction(interaction);
        this.curtainField.applyTemporaryReveal(
            interaction,
            temporaryReveal,
            temporaryDirectionalBias,
            this.parameters.minimumVisibleFactor,
            this.parameters.maximumVisibleFactor
        );
        if (retainedVisibleFactors) {
            const visibleFactors = this.curtainField.periods.map(
                (period, index) => Math.min(
                    this.parameters.maximumVisibleFactor,
                    Math.max(
                        this.parameters.minimumVisibleFactor,
                        period.visibleFactor + (
                            retainedVisibleFactors[index]
                                - interaction.visibleFactors[index]
                        ) * retainedDevelopment
                    )
                )
            );
            this.curtainField.setVisibleFactors(visibleFactors);
        }
        this.sceneVisibleFactor = this.curtainField
            .periods[interaction.periodIndex].visibleFactor;
        this.curtainField.resolve(this.parameters);
        const currentAnchor = this.curtainField
            .projectedXForInteraction(interaction);

        this.viewport.shiftProjectedOffset(
            currentAnchor - previousAnchor - fingerDisplacement
        );
        this.render();
        return true;
    }

    settleTouchExploration(
        interaction,
        initialReveal,
        initialDirectionalBias,
        directionalRetention,
        directionalResistance,
        initialViewportVelocity,
        inertiaGain,
        inertiaDamping,
        duration,
        curtainDevelopmentDuration = duration,
        revealRetention = 0,
        onFrame = null
    ) {
        if (!interaction
            || !Number.isFinite(initialReveal)
            || initialReveal < 0
            || !Number.isFinite(initialDirectionalBias)
            || !Number.isFinite(directionalRetention)
            || directionalRetention < 0
            || directionalRetention > 1
            || !Number.isFinite(directionalResistance)
            || directionalResistance <= 0
            || !Number.isFinite(initialViewportVelocity)
            || !Number.isFinite(inertiaGain)
            || inertiaGain < 0
            || !Number.isFinite(inertiaDamping)
            || inertiaDamping <= 0
            || !Number.isFinite(duration)
            || duration <= 0
            || !Number.isFinite(curtainDevelopmentDuration)
            || curtainDevelopmentDuration <= 0
            || !Number.isFinite(revealRetention)
            || revealRetention < 0
            || revealRetention > 1) {
            return false;
        }

        this.cancelTouchExplorationResponse();
        const retainedDirectionalBias = initialDirectionalBias
            * directionalRetention;
        const startingVisibleFactors = Object.freeze(
            this.curtainField.periods.map((period) => period.visibleFactor)
        );
        const retainedVisibleFactors = this.curtainField
            .retainedDirectionalFactors(
                interaction,
                retainedDirectionalBias,
                this.parameters.minimumVisibleFactor,
                this.parameters.maximumVisibleFactor,
                directionalResistance,
                initialReveal * revealRetention
            );
        this.touchExplorationState = {
            interaction,
            retainedVisibleFactors,
            viewportVelocity: initialViewportVelocity
        };
        let previousTimestamp = null;
        let inertiaStartedAt = null;
        let settleStartedAt = null;
        let settleStartingFactors = startingVisibleFactors;
        const settle = (timestamp) => {
            previousTimestamp ??= timestamp;
            const frameDuration = Math.min(
                Math.max(timestamp - previousTimestamp, 0),
                MAXIMUM_VIEWPORT_INERTIA_FRAME_DURATION
            );
            previousTimestamp = timestamp;
            let { viewportVelocity } = this.touchExplorationState;
            const viewportDirection = viewportVelocity > 0 ? -1 : 1;
            const canContinue = Math.abs(viewportVelocity)
                    > MINIMUM_VIEWPORT_INERTIA_VELOCITY
                && this.viewport.availableProjectedDisplacement(
                    viewportDirection
                ) > 0;

            if (canContinue) {
                if (frameDuration > 0) {
                    inertiaStartedAt ??= timestamp - frameDuration;
                    const retainedDevelopment = 1 - Math.exp(
                        -(timestamp - inertiaStartedAt)
                            / curtainDevelopmentDuration
                    );
                    const velocityScale = initialViewportVelocity === 0
                        ? 0
                        : viewportVelocity / initialViewportVelocity;
                    this.updateTouchExploration(
                        interaction,
                        viewportVelocity * inertiaGain * frameDuration,
                        initialReveal * Math.abs(velocityScale),
                        initialDirectionalBias * velocityScale,
                        retainedVisibleFactors,
                        retainedDevelopment
                    );
                    viewportVelocity *= Math.exp(
                        -inertiaDamping * frameDuration / 1000
                    );
                    this.touchExplorationState.viewportVelocity
                        = viewportVelocity;
                    onFrame?.();
                }
                this.touchExplorationFrame = requestAnimationFrame(settle);
                return;
            }

            this.touchExplorationState.viewportVelocity = 0;
            if (settleStartedAt === null) {
                settleStartedAt = timestamp;
                settleStartingFactors = Object.freeze(
                    this.curtainField.periods.map(
                        (period) => period.visibleFactor
                    )
                );
            }
            const progress = Math.min(
                (timestamp - settleStartedAt) / duration,
                1
            );
            const temporaryProgress = (1 - progress) ** 3;
            const visibleFactors = retainedVisibleFactors.map(
                (retained, index) => retained
                    + (
                        settleStartingFactors[index] - retained
                    ) * temporaryProgress
            );

            this.#applyTouchVisibleFactors(
                interaction,
                visibleFactors
            );
            onFrame?.();

            if (progress < 1) {
                this.touchExplorationFrame = requestAnimationFrame(settle);
            } else {
                this.touchExplorationFrame = null;
                this.touchExplorationState = null;
            }
        };

        this.touchExplorationFrame = requestAnimationFrame(settle);
        return true;
    }

    cancelTouchExplorationResponse() {
        if (!this.touchExplorationState) {
            return;
        }

        if (this.touchExplorationFrame !== null) {
            cancelAnimationFrame(this.touchExplorationFrame);
        }

        const {
            interaction,
            retainedVisibleFactors
        } = this.touchExplorationState;
        this.touchExplorationFrame = null;
        this.touchExplorationState = null;
        this.#applyTouchVisibleFactors(
            interaction,
            retainedVisibleFactors
        );
    }

    #applyTouchVisibleFactors(interaction, visibleFactors) {
        const previousAnchor = this.curtainField
            .projectedXForInteraction(interaction);
        this.curtainField.setVisibleFactors(visibleFactors);
        this.sceneVisibleFactor = visibleFactors[interaction.periodIndex];
        this.curtainField.resolve(this.parameters);
        const currentAnchor = this.curtainField
            .projectedXForInteraction(interaction);

        this.viewport.shiftProjectedOffset(currentAnchor - previousAnchor);
        this.render();
    }

    revealLocalInteraction(interaction) {
        if (!interaction
            || !this.artwork
            || this.attentionMode !== ATTENTION_MODE_EXPLORE) {
            return false;
        }

        this.cancelLocalReveal();
        this.cancelHorizontalReframe();
        const anchorProjectedX = this.curtainField
            .projectedXForInteraction(interaction);
        this.localRevealState = Object.freeze({
            interaction,
            anchorProjectedX,
            viewportOffset: this.viewport.projectedOffset
        });
        let startedAt = null;
        const reveal = (timestamp) => {
            startedAt ??= timestamp;
            const elapsed = timestamp - startedAt;
            const visibleFactors = mosesVisibleFactors(
                interaction,
                elapsed,
                this.parameters.maximumVisibleFactor
            );
            this.curtainField.setVisibleFactors(visibleFactors);
            this.sceneVisibleFactor = visibleFactors[
                interaction.periodIndex
            ];
            this.#anchorLocalReveal();
            this.render();

            if (elapsed < MOSES_REVEAL_DURATION) {
                this.localRevealFrame = requestAnimationFrame(reveal);
            } else {
                this.localRevealFrame = null;
                this.localRevealState = null;
            }
        };

        this.localRevealFrame = requestAnimationFrame(reveal);
        return true;
    }

    cancelLocalReveal() {
        if (!this.localRevealState) {
            return;
        }

        if (this.localRevealFrame !== null) {
            cancelAnimationFrame(this.localRevealFrame);
        }

        const { interaction, viewportOffset } = this.localRevealState;
        this.localRevealFrame = null;
        this.localRevealState = null;
        this.curtainField.setVisibleFactors(interaction.visibleFactors);
        this.sceneVisibleFactor = interaction.visibleFactors[
            interaction.periodIndex
        ];
        this.viewport.shiftProjectedOffset(
            viewportOffset - this.viewport.projectedOffset
        );
        this.render();
    }

    #anchorLocalReveal() {
        const {
            interaction,
            anchorProjectedX,
            viewportOffset
        } = this.localRevealState;
        this.curtainField.resolve(this.parameters);
        const currentAnchor = this.curtainField
            .projectedXForInteraction(interaction);
        const desiredOffset = viewportOffset
            + currentAnchor
            - anchorProjectedX;
        this.viewport.shiftProjectedOffset(
            desiredOffset - this.viewport.projectedOffset
        );
    }

    #rightwardInteractionAtCurrentProjectStart() {
        if (this.currentProjectIndex === null
            || !this.projectNavigation?.enabled) {
            return null;
        }

        const project = this.projectNavigation.projects[
            this.currentProjectIndex
        ];
        const projection = this.projectProjectionFor(project);
        if (!projection) {
            return null;
        }

        const grabSourceX = this.artwork.sourceXForLogicalX(
            project.artworkStart,
            this.logicalImageWidth
        );
        const grabColumn = this.projectedColumnAt(grabSourceX);
        if (!grabColumn) {
            return null;
        }

        const grabProjectedX = grabColumn.placement.targetX;
        return Object.freeze({
            interaction: this.curtainField
                .beginRightwardInteractionAtPeriod(
                    grabColumn.placement.periodIndex
                ),
            grabProjectedX,
            projectWidth: project.artworkEnd - project.artworkStart
        });
    }

    #applySemanticAutoOpen() {
        const grab = this.#rightwardInteractionAtCurrentProjectStart();
        if (!grab?.interaction) {
            return;
        }

        const finalDisplacement = grab.projectWidth;
        let startedAt = null;
        const drag = (timestamp) => {
            startedAt ??= timestamp;
            const progress = Math.min(
                (timestamp - startedAt) / SEMANTIC_AUTO_OPEN_DURATION,
                1
            );
            const horizontalDisplacement = finalDisplacement
                * smoothstep(progress);
            this.sceneVisibleFactor = this.curtainField.applyLocalDisplacement(
                grab.interaction,
                horizontalDisplacement,
                this.parameters.carrierDistance,
                this.parameters.minimumVisibleFactor,
                this.parameters.maximumVisibleFactor
            );
            this.render();

            if (progress < 1) {
                this.horizontalReframeFrame = requestAnimationFrame(drag);
            } else {
                this.horizontalReframeFrame = null;
            }
        };

        this.horizontalReframeFrame = requestAnimationFrame(drag);
    }

    #applyFlatSemanticProjectOpen() {
        const project = this.projectNavigation?.projects[
            this.currentProjectIndex
        ];
        if (!project || project.artworkEnd <= project.artworkStart) {
            return;
        }

        const firstSourceX = this.artwork.sourceXForLogicalX(
            project.artworkStart,
            this.logicalImageWidth
        );
        const lastSourceX = this.artwork.sourceXForLogicalX(
            project.artworkEnd - 1,
            this.logicalImageWidth
        );
        const firstPeriodIndex = this.projectedColumnAt(firstSourceX)
            ?.placement.periodIndex;
        const lastPeriodIndex = this.projectedColumnAt(lastSourceX)
            ?.placement.periodIndex;
        if (!Number.isInteger(firstPeriodIndex)
            || !Number.isInteger(lastPeriodIndex)) {
            return;
        }

        const startingVisibleFactor = this.curtainField.periods[
            firstPeriodIndex
        ].visibleFactor;
        const targetVisibleFactor = this.parameters.maximumVisibleFactor;
        let startedAt = null;
        const open = (timestamp) => {
            startedAt ??= timestamp;
            const progress = Math.min(
                (timestamp - startedAt) / PROJECT_REVEAL_DURATION,
                1
            );
            const visibleFactor = startingVisibleFactor
                + (targetVisibleFactor - startingVisibleFactor)
                    * smoothstep(progress);

            this.curtainField.setVisibleFactorRange(
                firstPeriodIndex,
                lastPeriodIndex,
                visibleFactor
            );
            this.sceneVisibleFactor = visibleFactor;
            this.render();

            if (progress < 1) {
                this.horizontalReframeFrame = requestAnimationFrame(open);
            } else {
                this.horizontalReframeFrame = null;
            }
        };

        this.horizontalReframeFrame = requestAnimationFrame(open);
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
            this.#logicalArtworkFrame(),
            this.curtainField
        );
        const projectedColumns = this.#projectGeometry(surface);
        this.projectedColumns = Object.freeze(projectedColumns);
        this.viewport.presentationExtent = contentFrame.width;
        const contentBounds = boundsFor(
            projectedColumns,
            0,
            projectedColumns.length
        );
        this.projectedContentBounds = contentBounds;

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
                    foldProgress: localParameters.foldProgress,
                    crestLifecycleMultiplier:
                        this.shading.crestLifecycleFor(localParameters)
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
            const geometryColumn = Object.freeze({
                ...column,
                sourceX: this.artwork.logicalXForSourceX(
                    sourceX,
                    this.logicalImageWidth
                )
            });
            placements[sourceX] = surface.mapColumn(
                geometryColumn,
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
            this.logicalArtworkWidth,
            this.parameters.carrierDistance
        );
    }

    #logicalArtworkFrame() {
        return Object.freeze({
            width: this.logicalArtworkWidth,
            height: this.artwork.height
        });
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

const HORIZONTAL_REFRAME_DISTANCE_FACTOR = 0.5;
const HORIZONTAL_REFRAME_DURATION = 450;
const SEMANTIC_AUTO_OPEN_DURATION = 125;
const PROJECT_REVEAL_DURATION = 1000;
const RESET_CURTAIN_DURATION = 600;
const READ_ENTRY_RESET_STATE = 0.5;
// Positive values shift the presented artwork left in the Viewport.
const READ_CENTER_OFFSET = 40;
const MOSES_OPEN_DURATION = 220;
const MOSES_HOLD_DURATION = 140;
const MOSES_SETTLE_DURATION = 1200;
const MOSES_PROPAGATION_DURATION = 240;
const MOSES_REVEAL_DURATION = MOSES_OPEN_DURATION
    + MOSES_HOLD_DURATION
    + MOSES_SETTLE_DURATION
    + MOSES_PROPAGATION_DURATION;
const MOSES_PROPAGATION_RADIUS = 6;
const MOSES_REMAINING_FOLD = 0.08;
const ATTENTION_MODE_EXPLORE = "explore";
const ATTENTION_MODE_READ = "read";
const PROJECT_OPENING_PROTOTYPE = "prototype";
const PROJECT_OPENING_FLAT_SPAN = "flat-semantic-span";
const MAXIMUM_VIEWPORT_INERTIA_FRAME_DURATION = 32;
const MINIMUM_VIEWPORT_INERTIA_VELOCITY = 0.05;
function resetEaseOut(value) {
    return 1 - (1 - value) ** 3;
}

function smoothstep(value) {
    return value ** 2 * (3 - 2 * value);
}

function mosesVisibleFactors(
    interaction,
    elapsed,
    maximumVisibleFactor
) {
    const clickPosition = interaction.periodIndex + interaction.localPosition;

    return interaction.visibleFactors.map((visibleFactor, periodIndex) => {
        const distance = distanceFromPeriod(
            clickPosition,
            periodIndex
        );
        if (distance > MOSES_PROPAGATION_RADIUS) {
            return visibleFactor;
        }

        const delay = distance / MOSES_PROPAGATION_RADIUS
            * MOSES_PROPAGATION_DURATION;
        const revealAmount = mosesRevealAmount(elapsed - delay);
        const distanceFade = mosesDistanceProfile(
            distance / MOSES_PROPAGATION_RADIUS
        );
        const availableOpening = Math.max(
            0,
            maximumVisibleFactor
                - MOSES_REMAINING_FOLD
                    * (maximumVisibleFactor - visibleFactor)
                - visibleFactor
        );

        return visibleFactor
            + availableOpening * distanceFade * revealAmount;
    });
}

function mosesDistanceProfile(normalizedDistance) {
    return 1 - smoothstep(normalizedDistance);
}

function distanceFromPeriod(clickPosition, periodIndex) {
    if (clickPosition < periodIndex) {
        return periodIndex - clickPosition;
    }

    if (clickPosition > periodIndex + 1) {
        return clickPosition - periodIndex - 1;
    }

    return 0;
}

function mosesRevealAmount(elapsed) {
    if (elapsed <= 0) {
        return 0;
    }

    if (elapsed < MOSES_OPEN_DURATION) {
        return smoothstep(elapsed / MOSES_OPEN_DURATION);
    }

    if (elapsed < MOSES_OPEN_DURATION + MOSES_HOLD_DURATION) {
        return 1;
    }

    const settleElapsed = elapsed
        - MOSES_OPEN_DURATION
        - MOSES_HOLD_DURATION;
    if (settleElapsed < MOSES_SETTLE_DURATION) {
        return (1 - settleElapsed / MOSES_SETTLE_DURATION) ** 3;
    }

    return 0;
}
