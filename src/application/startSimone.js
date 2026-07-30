import { loadArtwork } from "../artwork/loadArtwork.js";
import { CircularFoldSurface } from "../geometry/CircularFoldSurface.js";
import {
    OperatingPhase,
    OperatingPhaseResolver
} from "../geometry/OperatingPhaseResolver.js";
import {
    ViewportCanvasColumnRenderer
} from "../rendering/ViewportCanvasColumnRenderer.js";
import {
    currentBrowserName,
    FramePerformanceOverview
} from "../performance/FramePerformanceOverview.js";
import { ViewportApplication } from "./ViewportApplication.js";
import { ViewingSurface } from "../viewport/ViewingSurface.js";
import {
    createProjectNavigation
} from "../navigation/ProjectNavigation.js";
import { SurfaceShading } from "../shading/SurfaceShading.js";
import { CurtainField } from "../surface/CurtainField.js";
import { SurfaceParameters } from "../surface/SurfaceParameters.js";
import { Viewport } from "../viewport/Viewport.js";

/** Composition root for the existing surface architecture. */
export function startSimone() {
    const fileInput = document.getElementById("fileInput");
    const canvas = document.getElementById("canvas");
    const curtainPresentation = document.getElementById(
        "curtainPresentation"
    );
    const viewportPosition = document.getElementById("viewportPositionInput");
    const viewportPositionValue = document.getElementById(
        "viewportPositionValue"
    );
    const performanceOverviewElement = document.getElementById(
        "performanceOverview"
    );
    const semanticNavigationElement = document.getElementById(
        "semanticNavigation"
    );
    const conversationBarElement = document.getElementById(
        "conversationBar"
    );
    const debugPanelElement = document.getElementById("debugPanel");
    const debugReopenElement = document.getElementById("debugReopen");
    const controls = getSurfaceControls();

    if (!(fileInput instanceof HTMLInputElement)
        || !(canvas instanceof HTMLCanvasElement)
        || !(curtainPresentation instanceof HTMLElement)
        || !(viewportPosition instanceof HTMLInputElement)
        || !(viewportPositionValue instanceof HTMLOutputElement)
        || !(performanceOverviewElement instanceof HTMLElement)
        || !(semanticNavigationElement instanceof HTMLElement)
        || !(conversationBarElement instanceof HTMLElement)
        || !(debugPanelElement instanceof HTMLElement)
        || !(debugReopenElement instanceof HTMLButtonElement)) {
        throw new Error("SIMONE could not find its required interface elements.");
    }

    const circularFoldSurface = new CircularFoldSurface();
    const application = new ViewportApplication({
        artworkLoader: loadArtwork,
        parameters: new SurfaceParameters(),
        curtainField: new CurtainField(),
        viewport: new Viewport({
            projectedOffset: 0,
            projectedExtent: 0
        }),
        phaseResolver: new OperatingPhaseResolver(),
        surfaces: Object.freeze({
            [OperatingPhase.PRE_TRANSITION]: circularFoldSurface,
            [OperatingPhase.TRANSITION]: circularFoldSurface,
            [OperatingPhase.POST_TRANSITION]: circularFoldSurface
        }),
        shading: new SurfaceShading(),
        renderer: new ViewportCanvasColumnRenderer(canvas),
        viewingSurface: new ViewingSurface(canvas),
        performanceOverview: new FramePerformanceOverview(
            performanceOverviewElement,
            currentBrowserName()
        )
    });

    bindDebugPanel(debugPanelElement, debugReopenElement);
    bindSurfaceControls(controls, application);
    const synchronizeViewportControl = bindViewportControl(
        viewportPosition,
        viewportPositionValue,
        application
    );
    const synchronizeSemanticNavigation = bindSemanticNavigation(
        semanticNavigationElement,
        application,
        synchronizeViewportControl
    );
    const conversation = bindConversationInterface(
        conversationBarElement,
        application,
        synchronizeViewportControl,
        synchronizeSemanticNavigation
    );
    const synchronizeInterface = () => {
        synchronizeSemanticNavigation();
        conversation.synchronizeProjects();
    };
    bindCurtainDragging(
        canvas,
        application,
        synchronizeViewportControl,
        conversation
    );
    bindViewingSurfaceResize(
        curtainPresentation,
        application,
        synchronizeViewportControl
    );

    fileInput.addEventListener("change", async (event) => {
        const files = Array.from(event.target.files ?? []);
        if (files.length === 0) {
            return;
        }

        try {
            await application.importArtwork(files);
            await loadProjectNavigation(
                application,
                synchronizeInterface
            );
        } catch (error) {
            console.error("SIMONE could not import the artwork.", error);
        }
    });

    loadManifestArtwork(application, synchronizeInterface);

    return application;
}

function bindViewingSurfaceResize(
    element,
    application,
    synchronizeViewportControl
) {
    let frame = null;
    const scheduleRender = () => {
        if (frame !== null) {
            return;
        }
        frame = requestAnimationFrame(() => {
            frame = null;
            application.render();
            synchronizeViewportControl();
        });
    };

    window.addEventListener("resize", scheduleRender);
    window.visualViewport?.addEventListener("resize", scheduleRender);
    if ("ResizeObserver" in window) {
        const observer = new ResizeObserver(scheduleRender);
        observer.observe(element);
    }
}

export async function loadManifestArtwork(application, onNavigation = null) {
    const manifestUrl = manifestUrlFor(
        "public/images.txt",
        document.baseURI
    );

    try {
        const response = await fetch(manifestUrl);
        if (!response.ok) {
            throw new Error(
                `Image manifest request failed with ${response.status}.`
            );
        }

        const filenames = imageFilenamesFromManifest(await response.text());
        console.info([
            "Loaded images.txt",
            `Loaded at: ${manifestLoadTime()}`,
            `Images: ${filenames.length}`
        ].join("\n"));
        if (filenames.length === 0) {
            console.warn("SIMONE image manifest contains no image filenames.");
            return;
        }

        const sources = imageSourcesForFilenames(
            filenames,
            document.baseURI
        );
        await application.importArtwork(sources);
        await loadProjectNavigation(application, onNavigation);
    } catch (error) {
        console.error("SIMONE could not load its image manifest.", error);
    }
}

export async function loadProjectNavigation(application, onUpdate = null) {
    const projectsUrl = manifestUrlFor(
        "public/projects.txt",
        document.baseURI
    );

    try {
        const response = await fetch(projectsUrl);
        if (!response.ok) {
            throw new Error(
                `Project manifest request failed with ${response.status}.`
            );
        }

        const navigation = createProjectNavigation({
            source: await response.text(),
            loadedImageCount: application.imageCount
        });
        console.info([
            "Loaded projects.txt",
            `Loaded at: ${manifestLoadTime()}`,
            `Projects: ${navigation.projects.length}`,
            `Total span: ${navigation.projectSpanUnits}`,
            `Unused units: ${navigation.unusedUnits}`
        ].join("\n"));
        application.setProjectNavigation(navigation);
        onUpdate?.();

        if (!navigation.enabled) {
            console.error(
                `SIMONE semantic navigation is disabled: ${navigation.error}`
            );
            return;
        }

        console.info("SIMONE semantic project navigation", navigation);
        if (navigation.unusedUnits > 0) {
            console.warn(
                `${navigation.unusedUnits} artwork units remain after the `
                    + "final project span."
            );
        }
    } catch (error) {
        application.setProjectNavigation(null);
        onUpdate?.();
        console.error(
            "SIMONE could not configure semantic project navigation.",
            error
        );
    }
}

export function manifestUrlFor(path, applicationBaseUrl) {
    const url = new URL(path, applicationBaseUrl);
    if (isDevelopmentHost(url.hostname)) {
        url.searchParams.set("t", String(Date.now()));
    }
    return url;
}

function isDevelopmentHost(hostname) {
    return hostname === "localhost"
        || hostname === "127.0.0.1"
        || hostname === "[::1]"
        || hostname === "::1";
}

function manifestLoadTime() {
    return new Date().toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
    });
}

export function bindSemanticNavigation(
    element,
    application,
    synchronizeViewportControl
) {
    const previous = element.querySelector("[data-project-previous]");
    const next = element.querySelector("[data-project-next]");
    const select = element.querySelector("[data-project-select]");
    const label = element.querySelector("[data-project-label]");
    if (!(previous instanceof HTMLButtonElement)
        || !(next instanceof HTMLButtonElement)
        || !(select instanceof HTMLSelectElement)
        || !(label instanceof HTMLOutputElement)) {
        throw new Error("Semantic navigation controls are incomplete.");
    }

    const synchronize = () => {
        const navigation = application.projectNavigation;
        const index = application.currentProjectIndex;
        const available = navigation?.enabled && index !== null;

        if (!available) {
            label.value = "Project — / —";
            previous.disabled = true;
            next.disabled = true;
            select.disabled = true;
            select.replaceChildren(new Option("Choose project…", ""));
            return;
        }

        synchronizeProjectOptions(select, navigation.projects);
        const project = navigation.projects[index];
        label.value = `Project ${index + 1} / ${navigation.projects.length}`
            + ` — ${project.title}`;
        previous.disabled = index <= 0;
        next.disabled = index >= navigation.projects.length - 1;
        select.disabled = false;
        select.value = String(index);
    };

    previous.addEventListener("click", () => {
        application.navigateToPreviousProject(synchronizeViewportControl);
        synchronize();
    });
    next.addEventListener("click", () => {
        application.navigateToNextProject(synchronizeViewportControl);
        synchronize();
    });
    select.addEventListener("change", () => {
        const targetIndex = Number(select.value);
        if (!Number.isInteger(targetIndex)) {
            return;
        }

        application.resetAndNavigateToProject(
            targetIndex,
            synchronizeViewportControl,
            synchronize
        );
    });
    synchronize();

    return synchronize;
}

function synchronizeProjectOptions(select, projects) {
    if (select.options.length === projects.length
        && projects.every((project, index) => (
            select.options[index]?.textContent === project.title
        ))) {
        return;
    }

    select.replaceChildren(...projects.map((project, index) => (
        new Option(project.title, String(index))
    )));
}

export function imageFilenamesFromManifest(manifest) {
    return manifest.split(/\r?\n/u)
        .filter((line) => line.trim() !== "" && !line.startsWith("#"));
}

export function imageSourcesForFilenames(filenames, applicationBaseUrl) {
    const imageDirectory = new URL("public/images/", applicationBaseUrl);

    return filenames.map((name) => Object.freeze({
        name,
        url: new URL(encodeURIComponent(name), imageDirectory).href
    }));
}

function bindViewportControl(input, output, application) {
    const synchronize = () => {
        const position = application.viewport.position * 100;
        input.value = String(position);
        output.value = `${formatPosition(position)}% · X ${
            formatPosition(application.viewport.projectedOffset)
        } projected px`;
    };
    const update = () => {
        const position = Number(input.value);
        application.updateViewportPosition(position / 100);
        synchronize();
    };

    input.addEventListener("input", update);
    synchronize();

    return synchronize;
}

function getSurfaceControls() {
    const controls = {
        minimumVisibleFactor: getControlPair("minimumVisibleFactor"),
        maximumVisibleFactor: getControlPair("maximumVisibleFactor"),
        resetCurtainState: getControlPair("resetCurtainState"),
        carrierDistance: getControlPair("carrierDistance"),
        modelTransition: getControlPair("modelTransition")
    };

    if (Object.values(controls).some((control) => !control)) {
        throw new Error("SIMONE could not find its periodic surface controls.");
    }

    return controls;
}

function getControlPair(name) {
    const range = document.getElementById(`${name}Input`);
    const number = document.getElementById(`${name}Number`);

    if (!(range instanceof HTMLInputElement) || !(number instanceof HTMLInputElement)) {
        return null;
    }

    return Object.freeze({ range, number });
}

function bindSurfaceControls(controls, application) {
    const currentValues = () => ({
            minimumVisibleFactor:
                Number(controls.minimumVisibleFactor.range.value) / 100,
            maximumVisibleFactor:
                Number(controls.maximumVisibleFactor.range.value) / 100,
            resetCurtainState:
                Number(controls.resetCurtainState.number.value) / 100,
            carrierDistance: Number(controls.carrierDistance.range.value),
            modelTransition: Number(controls.modelTransition.range.value) / 100
        });
    const updateApplication = () => {
        application.updateSurface(currentValues());
    };
    const animateReset = () => {
        application.animateResetCurtainState(currentValues());
    };

    bindControlPair(controls.minimumVisibleFactor, () => {
        constrainVisibleFactorControls(controls, "minimum");
        updateApplication();
    });
    bindControlPair(controls.maximumVisibleFactor, () => {
        constrainVisibleFactorControls(controls, "maximum");
        updateApplication();
    });
    bindResetCurtainStateControl(controls, animateReset);
    bindControlPair(controls.carrierDistance, updateApplication);
    bindControlPair(controls.modelTransition, updateApplication);

    constrainVisibleFactorControls(controls);
    updateApplication();

    return updateApplication;
}

export function bindDebugPanel(panel, reopen) {
    const close = panel.querySelector("[data-debug-close]");
    if (!(close instanceof HTMLButtonElement)
        || !(reopen instanceof HTMLButtonElement)) {
        throw new Error("Development panel controls are incomplete.");
    }

    close.addEventListener("click", () => {
        panel.hidden = true;
        reopen.hidden = false;
        reopen.focus();
    });
    reopen.addEventListener("click", () => {
        reopen.hidden = true;
        panel.hidden = false;
        close.focus();
    });
}

export function bindCurtainDragging(
    canvas,
    application,
    synchronizeViewportControl,
    conversation
) {
    let drag = null;
    let touchExploration = null;
    let touchPinch = null;
    const touchPointers = new Map();

    const beginTouchExploration = (pointer, clickRevealAllowed = true) => {
        const bounds = canvas.getBoundingClientRect();
        const width = canvas.clientWidth;
        if (width <= 0) {
            return false;
        }

        const canvasScale = canvas.width / width;
        const targetX = (
            pointer.clientX - bounds.left - canvas.clientLeft
        ) * canvasScale;
        const interaction = application.beginTouchExploration(targetX);
        if (!interaction) {
            return false;
        }

        touchExploration = {
            pointerId: pointer.pointerId,
            startX: pointer.clientX,
            startY: pointer.clientY,
            lastX: pointer.clientX,
            lastTimestamp: pointer.timeStamp,
            displacementScale: application.interactionDisplacementScale(
                width
            ),
            interaction,
            project: application.projectAtPresentationX(targetX),
            smoothedVelocity: 0,
            temporaryReveal: 0,
            temporaryDirectionalBias: 0,
            dragLearned: false,
            clickRevealAllowed
        };
        canvas.classList.add("is-dragging");
        return true;
    };

    const beginTouchPinch = () => {
        const pointers = Array.from(touchPointers.values());
        const width = canvas.clientWidth;
        if (pointers.length !== 2 || width <= 0) {
            return false;
        }

        const bounds = canvas.getBoundingClientRect();
        const canvasScale = canvas.width / width;
        const initialDistance = touchDistance(pointers[0], pointers[1]);
        const midpointX = (pointers[0].clientX + pointers[1].clientX) / 2;
        const targetXFor = (clientX) => (
            clientX - bounds.left - canvas.clientLeft
        ) * canvasScale;
        const interaction = application.beginTouchPinch(
            targetXFor(midpointX - initialDistance / 2),
            targetXFor(midpointX + initialDistance / 2)
        );
        if (!interaction) {
            return false;
        }

        touchExploration = null;
        touchPinch = {
            interaction,
            firstPointerId: pointers[0].pointerId,
            secondPointerId: pointers[1].pointerId,
            initialDistance,
            displacementScale: application.interactionDisplacementScale(width)
        };
        return true;
    };

    canvas.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) {
            return;
        }

        const bounds = canvas.getBoundingClientRect();
        const width = canvas.clientWidth;
        if (width <= 0) {
            return;
        }

        const canvasScale = canvas.width / width;
        const targetX = (
            event.clientX - bounds.left - canvas.clientLeft
        ) * canvasScale;
        const pointerPosition = (
            event.clientX - bounds.left - canvas.clientLeft
        ) / width;
        const isDirectTouch = event.pointerType === "touch";
        if (isDirectTouch) {
            if (touchPointers.size >= 2) {
                event.preventDefault();
                return;
            }

            const pointer = touchPointerFrom(event);
            touchPointers.set(event.pointerId, pointer);
            canvas.setPointerCapture(event.pointerId);
            if (touchPointers.size === 1) {
                beginTouchExploration(pointer);
            } else {
                beginTouchPinch();
            }
            event.preventDefault();
            return;
        }

        const interaction = application.beginLocalInteraction(targetX);
        const project = application.projectAtPresentationX(targetX);

        if (!interaction) {
            return;
        }

        drag = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            startPointerPosition: pointerPosition,
            displacementScale: application.interactionDisplacementScale(
                width
            ),
            interaction,
            project,
            dragLearned: false
        };

        canvas.setPointerCapture(event.pointerId);
        canvas.classList.add("is-dragging");
        event.preventDefault();
    });

    canvas.addEventListener("pointermove", (event) => {
        if (event.pointerType === "touch"
            && touchPointers.has(event.pointerId)) {
            touchPointers.set(event.pointerId, touchPointerFrom(event));
            if (touchPinch) {
                const first = touchPointers.get(
                    touchPinch.firstPointerId
                );
                const second = touchPointers.get(
                    touchPinch.secondPointerId
                );
                if (first && second) {
                    const separationDisplacement = (
                        touchDistance(first, second)
                            - touchPinch.initialDistance
                    ) * touchPinch.displacementScale / 2;
                    application.updateTouchPinch(
                        touchPinch.interaction,
                        -separationDisplacement,
                        separationDisplacement
                    );
                }
                event.preventDefault();
                return;
            }
        }

        if (touchExploration
            && event.pointerId === touchExploration.pointerId) {
            const horizontalMovement = event.clientX
                - touchExploration.lastX;
            const projectedMovement = horizontalMovement
                * touchExploration.displacementScale;
            const elapsed = Math.max(
                1,
                Math.min(
                    event.timeStamp - touchExploration.lastTimestamp,
                    TOUCH_EXPLORATION_MAXIMUM_SAMPLE_DURATION
                )
            );
            const velocity = projectedMovement / elapsed;
            touchExploration.smoothedVelocity = lowPass(
                touchExploration.smoothedVelocity,
                velocity,
                elapsed,
                TOUCH_CURTAIN_VELOCITY_SMOOTHING
            );
            const targetReveal = Math.min(
                Math.abs(touchExploration.smoothedVelocity)
                    * TOUCH_CURTAIN_VELOCITY_TO_REVEAL,
                TOUCH_CURTAIN_MAXIMUM_TEMPORARY_REVEAL
            );
            touchExploration.temporaryReveal = lowPass(
                touchExploration.temporaryReveal,
                targetReveal,
                elapsed,
                TOUCH_CURTAIN_FOLLOW_RATE
            );
            const targetDirectionalBias = clamp(
                touchExploration.smoothedVelocity
                    * TOUCH_CURTAIN_VELOCITY_TO_DIRECTIONAL_BIAS,
                -TOUCH_CURTAIN_MAXIMUM_TEMPORARY_REVEAL,
                TOUCH_CURTAIN_MAXIMUM_TEMPORARY_REVEAL
            );
            touchExploration.temporaryDirectionalBias = lowPass(
                touchExploration.temporaryDirectionalBias,
                targetDirectionalBias,
                elapsed,
                TOUCH_CURTAIN_FOLLOW_RATE
            );

            if (!touchExploration.dragLearned && !isCurtainClick(
                event.clientX - touchExploration.startX,
                event.clientY - touchExploration.startY
            )) {
                touchExploration.dragLearned = true;
                conversation.markDragLearned();
            }

            application.updateTouchExploration(
                touchExploration.interaction,
                projectedMovement,
                touchExploration.temporaryReveal,
                touchExploration.temporaryDirectionalBias
            );
            touchExploration.lastX = event.clientX;
            touchExploration.lastTimestamp = event.timeStamp;
            synchronizeViewportControl();
            event.preventDefault();
            return;
        }

        if (!drag || event.pointerId !== drag.pointerId) {
            return;
        }

        const horizontalDisplacement = (
            event.clientX - drag.startX
        ) * drag.displacementScale;
        if (!drag.dragLearned && !isCurtainClick(
            event.clientX - drag.startX,
            event.clientY - drag.startY
        )) {
            drag.dragLearned = true;
            conversation.markDragLearned();
        }
        application.updateLocalInteraction(
            drag.interaction,
            horizontalDisplacement
        );
        synchronizeViewportControl();
    });

    const finishDragging = (event, allowClickReveal) => {
        if (!drag || event.pointerId !== drag.pointerId) {
            return;
        }

        if (canvas.hasPointerCapture(event.pointerId)) {
            canvas.releasePointerCapture(event.pointerId);
        }

        const totalProjectedDisplacement = (
            event.clientX - drag.startX
        ) * drag.displacementScale;
        const dragStartPosition = drag.startPointerPosition;
        const reframeDirection = horizontalReframeDirection(
            dragStartPosition,
            totalProjectedDisplacement,
            application.viewport.projectedExtent
        );
        const grabbedInteraction = drag.interaction;
        const grabbedProject = drag.project;
        const clickReveal = allowClickReveal && isCurtainClick(
            event.clientX - drag.startX,
            event.clientY - drag.startY
        );

        drag = null;
        canvas.classList.remove("is-dragging");
        if (clickReveal && grabbedProject) {
            if (application.revealLocalInteraction(grabbedInteraction)) {
                conversation.showProject(grabbedProject);
            }
        } else if (clickReveal) {
            conversation.showDragHint();
        } else if (reframeDirection !== 0) {
            application.reframeHorizontal(
                reframeDirection,
                grabbedInteraction,
                synchronizeViewportControl
            );
        }
    };

    const finishTouchExploration = (event, allowClickReveal) => {
        if (!touchExploration
            || event.pointerId !== touchExploration.pointerId) {
            return;
        }

        if (canvas.hasPointerCapture(event.pointerId)) {
            canvas.releasePointerCapture(event.pointerId);
        }

        const completed = touchExploration;
        const clickReveal = allowClickReveal
            && completed.clickRevealAllowed
            && isCurtainClick(
                event.clientX - completed.startX,
                event.clientY - completed.startY
            );
        touchExploration = null;
        canvas.classList.remove("is-dragging");

        if (clickReveal) {
            application.updateTouchExploration(
                completed.interaction,
                0,
                0,
                0
            );
            if (completed.project
                && application.revealLocalInteraction(completed.interaction)) {
                conversation.showProject(completed.project);
            } else if (!completed.project) {
                conversation.showDragHint();
            }
        } else {
            application.settleTouchExploration(
                completed.interaction,
                completed.temporaryReveal,
                completed.temporaryDirectionalBias,
                TOUCH_CURTAIN_DIRECTIONAL_RETENTION,
                TOUCH_CURTAIN_DIRECTIONAL_RESISTANCE,
                clamp(
                    completed.smoothedVelocity,
                    -TOUCH_CURTAIN_MAXIMUM_TEMPORARY_REVEAL
                        / TOUCH_CURTAIN_VELOCITY_TO_DIRECTIONAL_BIAS,
                    TOUCH_CURTAIN_MAXIMUM_TEMPORARY_REVEAL
                        / TOUCH_CURTAIN_VELOCITY_TO_DIRECTIONAL_BIAS
                ),
                VIEWPORT_INERTIA_GAIN,
                VIEWPORT_INERTIA_DAMPING,
                TOUCH_CURTAIN_SETTLE_DURATION,
                TOUCH_CURTAIN_INERTIA_DEVELOPMENT_DURATION,
                TOUCH_CURTAIN_REVEAL_RETENTION,
                synchronizeViewportControl
            );
        }
    };

    const finishTouchPointer = (event, allowClickReveal) => {
        if (!touchPointers.has(event.pointerId)) {
            return;
        }

        touchPointers.delete(event.pointerId);
        if (touchPinch) {
            if (canvas.hasPointerCapture(event.pointerId)) {
                canvas.releasePointerCapture(event.pointerId);
            }
            touchPinch = null;
            if (touchPointers.size === 1) {
                beginTouchExploration(
                    Array.from(touchPointers.values())[0],
                    false
                );
            } else {
                touchExploration = null;
                canvas.classList.remove("is-dragging");
            }
            return;
        }

        finishTouchExploration(event, allowClickReveal);
    };

    canvas.addEventListener("pointerup", (event) => {
        if (event.pointerType === "touch") {
            finishTouchPointer(event, true);
            return;
        }
        finishDragging(event, true);
    });
    canvas.addEventListener("pointercancel", (event) => {
        if (event.pointerType === "touch") {
            finishTouchPointer(event, false);
            return;
        }
        finishDragging(event, false);
    });
}

export function bindConversationInterface(
    element,
    application,
    synchronizeViewportControl,
    synchronizeSemanticNavigation
) {
    const conversation = element.querySelector("[data-conversation-text]");
    const trigger = element.querySelector("[data-conversation-menu-trigger]");
    const panel = element.querySelector(".conversation-project-list");
    const list = element.querySelector("[data-conversation-projects]");
    if (!(conversation instanceof HTMLOutputElement)
        || !(trigger instanceof HTMLButtonElement)
        || !(panel instanceof HTMLElement)
        || !(list instanceof HTMLUListElement)) {
        throw new Error("Conversation interface is incomplete.");
    }

    let menuOpen = false;
    let dragLearned = false;
    let projectTitlePresented = false;
    let exploredProjectIndex = null;
    const closeMenu = ({ restoreFocus = true } = {}) => {
        menuOpen = false;
        panel.hidden = true;
        element.classList.remove("is-menu-open");
        trigger.textContent = "☰";
        trigger.setAttribute("aria-expanded", "false");
        trigger.setAttribute("aria-label", "Open project list");
        if (restoreFocus) {
            trigger.focus();
        }
    };
    const openMenu = () => {
        menuOpen = true;
        synchronizeProjects();
        panel.hidden = false;
        element.classList.add("is-menu-open");
        trigger.textContent = "×";
        trigger.setAttribute("aria-expanded", "true");
        trigger.setAttribute("aria-label", "Close project list");
        const active = list.querySelector('[aria-current="true"]');
        (active ?? list.querySelector("button"))?.focus();
    };
    const selectProject = (index) => {
        const project = application.projectNavigation?.projects[index];
        if (!project) {
            return;
        }

        showProject(project);
        closeMenu({ restoreFocus: false });
        application.resetAndNavigateToProject(
            index,
            synchronizeViewportControl,
            () => {
                synchronizeSemanticNavigation();
                synchronizeProjects();
            }
        );
    };
    const synchronizeProjects = () => {
        const projects = application.projectNavigation?.projects;
        if (!application.projectNavigation?.enabled || !projects) {
            list.replaceChildren();
            return;
        }

        list.replaceChildren(...projects.map((project, index) => {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = project.title;
            const activeIndex = application.attentionMode === "read"
                ? application.currentProjectIndex
                : exploredProjectIndex;
            if (index === activeIndex) {
                button.setAttribute("aria-current", "true");
            }
            button.addEventListener("click", () => selectProject(index));
            const item = document.createElement("li");
            item.append(button);
            return item;
        }));
    };
    const showProject = (project) => {
        projectTitlePresented = true;
        const projectIndex = application.projectNavigation?.projects
            .indexOf(project);
        exploredProjectIndex = Number.isInteger(projectIndex)
            && projectIndex >= 0
            ? projectIndex
            : null;
        conversation.value = project.title;
    };
    const showDragHint = () => {
        if (!dragLearned && !projectTitlePresented) {
            conversation.value = "Drag me";
        }
    };
    const markDragLearned = () => {
        dragLearned = true;
    };

    trigger.addEventListener("click", () => {
        if (menuOpen) {
            closeMenu();
        } else {
            openMenu();
        }
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && menuOpen) {
            closeMenu();
        }
    });

    synchronizeProjects();
    return Object.freeze({
        synchronizeProjects,
        showProject,
        showDragHint,
        markDragLearned
    });
}

export function isCurtainClick(horizontalMovement, verticalMovement) {
    return Math.hypot(horizontalMovement, verticalMovement)
        <= CURTAIN_CLICK_TOLERANCE;
}

export function lowPass(
    currentValue,
    targetValue,
    elapsed,
    timeConstant
) {
    const progress = 1 - Math.exp(-elapsed / timeConstant);
    return currentValue + (targetValue - currentValue) * progress;
}

function constrainVisibleFactorControls(controls, changedBoundary) {
    let minimum = Number(controls.minimumVisibleFactor.range.value);
    let maximum = Number(controls.maximumVisibleFactor.range.value);

    if (minimum > maximum && changedBoundary === "minimum") {
        maximum = minimum;
        setControlPairValue(controls.maximumVisibleFactor, maximum);
    } else if (maximum < minimum && changedBoundary === "maximum") {
        minimum = maximum;
        setControlPairValue(controls.minimumVisibleFactor, minimum);
    }

    controls.resetCurtainState.number.min = String(minimum);
    controls.resetCurtainState.number.max = String(maximum);

    const resetCurtainState = clamp(
        Number(controls.resetCurtainState.number.value),
        minimum,
        maximum
    );
    setResetCurtainState(controls, resetCurtainState);
}

function bindResetCurtainStateControl(controls, onUpdate) {
    const pair = controls.resetCurtainState;

    pair.range.addEventListener("input", () => {
        const minimum = Number(controls.minimumVisibleFactor.range.value);
        const maximum = Number(controls.maximumVisibleFactor.range.value);
        const progress = Number(pair.range.value) / 100;
        pair.number.value = formatPosition(
            minimum + progress * (maximum - minimum)
        );
        onUpdate();
    });

    const updateFromNumber = () => {
        const minimum = Number(controls.minimumVisibleFactor.range.value);
        const maximum = Number(controls.maximumVisibleFactor.range.value);
        setResetCurtainState(
            controls,
            clamp(Number(pair.number.value), minimum, maximum)
        );
        onUpdate();
    };

    pair.number.addEventListener("input", updateFromNumber);
    pair.number.addEventListener("change", updateFromNumber);
}

function setResetCurtainState(controls, resetCurtainState) {
    const minimum = Number(controls.minimumVisibleFactor.range.value);
    const maximum = Number(controls.maximumVisibleFactor.range.value);
    const range = maximum - minimum;
    const progress = range === 0
        ? 0
        : (resetCurtainState - minimum) / range;

    controls.resetCurtainState.range.value = String(progress * 100);
    controls.resetCurtainState.number.value = formatPosition(
        resetCurtainState
    );
}

function bindControlPair(pair, onUpdate) {
    const synchronize = (source, target) => {
        const value = Number(source.value);
        if (!Number.isFinite(value)) {
            return;
        }

        const minimum = Number(pair.range.min);
        const maximum = Number(pair.range.max);
        const clampedValue = clamp(value, minimum, maximum);

        source.value = String(clampedValue);
        target.value = String(clampedValue);
        onUpdate();
    };

    pair.range.addEventListener("input", () => synchronize(pair.range, pair.number));
    pair.number.addEventListener("input", () => synchronize(pair.number, pair.range));
    pair.number.addEventListener("change", () => synchronize(pair.number, pair.range));
    setControlPairValue(pair, pair.range.value);
}

function setControlPairValue(pair, value) {
    pair.range.value = String(value);
    pair.number.value = String(value);
}

function formatPosition(value) {
    return String(Number(value.toFixed(2)));
}

const HORIZONTAL_REFRAME_EDGE_FRACTION = 0.2;
const MINIMUM_EXPLORATORY_DRAG_FRACTION = 0.1;
const CURTAIN_CLICK_TOLERANCE = 5;
const TOUCH_EXPLORATION_MAXIMUM_SAMPLE_DURATION = 50;
const TOUCH_CURTAIN_VELOCITY_SMOOTHING = 45;
const TOUCH_CURTAIN_FOLLOW_RATE = 90;
const TOUCH_CURTAIN_VELOCITY_TO_REVEAL = 0.04;
const TOUCH_CURTAIN_MAXIMUM_TEMPORARY_REVEAL = 0.30;
const TOUCH_CURTAIN_VELOCITY_TO_DIRECTIONAL_BIAS = 0.10;
const TOUCH_CURTAIN_DIRECTIONAL_RETENTION = 1.00;
const TOUCH_CURTAIN_DIRECTIONAL_RESISTANCE = 3.00;
const TOUCH_CURTAIN_REVEAL_RETENTION = 0.60;
const VIEWPORT_INERTIA_GAIN = 1.75;
const VIEWPORT_INERTIA_DAMPING = 4.00;
const TOUCH_CURTAIN_SETTLE_DURATION = 360;
const TOUCH_CURTAIN_INERTIA_DEVELOPMENT_DURATION = 160;

export function horizontalReframeDirection(
    startPointerPosition,
    totalProjectedDisplacement,
    projectedViewportWidth
) {
    const minimumDisplacement = projectedViewportWidth
        * MINIMUM_EXPLORATORY_DRAG_FRACTION;

    if (startPointerPosition > 1 - HORIZONTAL_REFRAME_EDGE_FRACTION
        && totalProjectedDisplacement < -minimumDisplacement) {
        return 1;
    }

    if (startPointerPosition < HORIZONTAL_REFRAME_EDGE_FRACTION
        && totalProjectedDisplacement > minimumDisplacement) {
        return -1;
    }

    return 0;
}

function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), maximum);
}

function touchPointerFrom(event) {
    return Object.freeze({
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        timeStamp: event.timeStamp
    });
}

function touchDistance(first, second) {
    return Math.hypot(
        second.clientX - first.clientX,
        second.clientY - first.clientY
    );
}
