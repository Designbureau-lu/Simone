import { loadArtwork } from "../artwork/loadArtwork.js";
import { ImmutableArtwork } from "../artwork/ImmutableArtwork.js";
import {
    artworkRepresentationIdsFromManifest,
    artworkSegmentsFromManifest,
    representationLabel
} from "../artwork/ArtworkManifest.js";
import {
    ArtworkSegmentScheduler,
    SegmentLoadState,
    SegmentPriority
} from "../artwork/ArtworkSegmentScheduler.js";
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
    const artworkSourceRepresentation = document.getElementById(
        "artworkSourceRepresentation"
    );
    const mobileSnapBoxToggle = document.getElementById("mobileSnapBoxToggle");
    const mobileSnapBoxOutput = document.getElementById("mobileSnapBoxOutput");
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
        || !(debugReopenElement instanceof HTMLButtonElement)
        || !(artworkSourceRepresentation instanceof HTMLSelectElement)
        || !(mobileSnapBoxToggle instanceof HTMLInputElement)
        || !(mobileSnapBoxOutput instanceof HTMLPreElement)) {
        throw new Error("SIMONE could not find its required interface elements.");
    }

    const circularFoldSurface = new CircularFoldSurface();
    const renderer = new ViewportCanvasColumnRenderer(canvas);
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
        renderer,
        viewingSurface: new ViewingSurface(canvas),
        performanceOverview: new FramePerformanceOverview(
            performanceOverviewElement,
            currentBrowserName(),
            canvas
        ),
        useLeadingProjectAlignment: window.matchMedia?.(
            "(pointer: coarse)"
        ).matches === true
    });
    bindDebugPanel(debugPanelElement, debugReopenElement);
    bindMobileSnapBoxDiagnostic(mobileSnapBoxToggle, mobileSnapBoxOutput);
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

    loadManifestArtwork(
        application,
        synchronizeInterface,
        artworkSourceRepresentation
    );

    return application;
}

export function bindMobileSnapBoxDiagnostic(toggle, output) {
    const screenOne = document.querySelector(".arrival-screen-identity");
    const screenTwo = document.querySelector(".curtain-sticky-stage");
    const editorial = document.querySelector(".exhibition-information");
    if (!(toggle instanceof HTMLInputElement)
        || !(output instanceof HTMLPreElement)
        || !(screenOne instanceof HTMLElement)
        || !(screenTwo instanceof HTMLElement)
        || !(editorial instanceof HTMLElement)) {
        throw new Error("Mobile snap-box diagnostic elements are incomplete.");
    }

    let frame = null;
    const documentBounds = (element) => {
        const bounds = element.getBoundingClientRect();
        const top = bounds.top + window.scrollY;
        return Object.freeze({
            height: Number.parseFloat(getComputedStyle(element).height),
            top,
            bottom: top + bounds.height
        });
    };
    const update = () => {
        frame = null;
        if (!toggle.checked) {
            return;
        }
        const first = documentBounds(screenOne);
        const second = documentBounds(screenTwo);
        const content = documentBounds(editorial);
        const visualHeight = window.visualViewport?.height;
        output.textContent = [
            "MOBILE SNAP BOXES",
            `window.innerHeight: ${formatDiagnosticNumber(window.innerHeight)} px`,
            `document.clientHeight: ${formatDiagnosticNumber(document.documentElement.clientHeight)} px`,
            `visualViewport.height: ${Number.isFinite(visualHeight) ? `${formatDiagnosticNumber(visualHeight)} px` : "unavailable"}`,
            `window.scrollY: ${formatDiagnosticNumber(window.scrollY)} px`,
            "",
            ...layoutBoxRows("SCREEN 1 · 100dvh · NO SNAP", first, "100dvh"),
            "",
            ...snapBoxRows("SCREEN 2 · 100dvh · SNAP START", second, "100dvh"),
            "",
            `EDITORIAL top: ${formatDiagnosticNumber(content.top)} px`
        ].join("\n");
    };
    const scheduleUpdate = () => {
        if (frame !== null || !toggle.checked) {
            return;
        }
        frame = requestAnimationFrame(update);
    };
    const setEnabled = () => {
        const enabled = toggle.checked
            && window.matchMedia("(max-width: 767px)").matches;
        document.body.toggleAttribute("data-show-mobile-snap-boxes", enabled);
        output.hidden = !enabled;
        if (enabled) {
            update();
        }
    };

    toggle.checked = false;
    document.body.removeAttribute("data-show-mobile-snap-boxes");
    output.hidden = true;
    toggle.addEventListener("change", setEnabled);
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", () => {
        setEnabled();
        scheduleUpdate();
    });
    window.visualViewport?.addEventListener("resize", scheduleUpdate);
    window.visualViewport?.addEventListener("scroll", scheduleUpdate);

    return Object.freeze({ update, setEnabled });
}

function snapBoxRows(label, bounds, heightRule) {
    return [
        ...layoutBoxRows(label, bounds, heightRule),
        `${label} snap-start: ${formatDiagnosticNumber(bounds.top)} px`,
        `${label} snap distance: ${formatDiagnosticNumber(bounds.top - window.scrollY)} px`
    ];
}

function layoutBoxRows(label, bounds, heightRule) {
    return [
        `${label} height: ${formatDiagnosticNumber(bounds.height)} px (${heightRule})`,
        `${label} top: ${formatDiagnosticNumber(bounds.top)} px`,
        `${label} bottom: ${formatDiagnosticNumber(bounds.bottom)} px`
    ];
}

function formatDiagnosticNumber(value) {
    return Number.isFinite(value) ? value.toFixed(2) : "—";
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

export async function loadManifestArtwork(
    application,
    onNavigation = null,
    representationControl = null
) {
    const manifestUrl = manifestUrlFor(
        "public/artwork.json",
        document.baseURI
    );

    try {
        const response = await fetch(manifestUrl);
        if (!response.ok) {
            throw new Error(
                `Image manifest request failed with ${response.status}.`
            );
        }

        const manifestSource = await response.text();
        const availableRepresentationIds =
            artworkRepresentationIdsFromManifest(manifestSource);
        const representationId = selectedArtworkRepresentationId(
            availableRepresentationIds
        );
        clearArtworkRepresentationOverride();
        if (representationControl) {
            bindArtworkRepresentationControl(
                representationControl,
                availableRepresentationIds,
                representationId
            );
        }
        const segments = artworkSegmentsFromManifest(
            manifestSource,
            document.baseURI,
            representationId
        );
        console.info([
            "Loaded artwork.json",
            `Loaded at: ${manifestLoadTime()}`,
            `Images: ${segments.length}`,
            `Representation: ${representationLabel(representationId)}`
        ].join("\n"));
        const artwork = ImmutableArtwork.fromMetadata(segments);
        application.initializeArtwork(artwork);
        const initialSegments = application
            .requiredSegmentIndicesForCurrentViewport();
        const scheduler = new ArtworkSegmentScheduler({ artwork });
        application.setArtworkSegmentScheduler(scheduler);
        let initialCurtainPresented = false;
        scheduler.onStateChange(({ index, state }) => {
            if (initialCurtainPresented
                && state === SegmentLoadState.DECODED
                && application.segmentIntersectsCurrentViewport(index)) {
                application.render();
            }
        });
        const navigation = loadProjectNavigation(
            application,
            onNavigation
        );
        await scheduler.request(
            initialSegments,
            SegmentPriority.INITIAL_VIEWPORT
        );
        application.render();
        initialCurtainPresented = true;
        application.startBackgroundArtworkLoading();
        await navigation;
    } catch (error) {
        console.error("SIMONE could not load its image manifest.", error);
    }
}

export function selectedArtworkRepresentationId(
    availableIds,
    locationUrl = window.location.href,
    userAgent = window.navigator.userAgent
) {
    const requested = new URL(locationUrl).searchParams.get(
        "debug-artwork-source"
    ) ?? (isChromeUserAgent(userAgent) ? "b" : "a");
    if (!availableIds.includes(requested)) {
        throw new RangeError(
            `Artwork representation "${requested}" is not available for `
            + "every segment."
        );
    }
    return requested;
}

export function isChromeUserAgent(userAgent) {
    const chromeBrand = /(?:Chrome|CriOS)\/\d/i.test(userAgent);
    const otherChromiumBrand = /(?:Edg|EdgiOS|OPR|Opera|SamsungBrowser|YaBrowser)\//i
        .test(userAgent);
    return chromeBrand && !otherChromiumBrand;
}

function clearArtworkRepresentationOverride() {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("debug-artwork-source")) {
        return;
    }
    window.history.replaceState(
        window.history.state,
        "",
        artworkRepresentationUrlWithoutOverride(url.href)
    );
}

export function artworkRepresentationUrlWithoutOverride(locationUrl) {
    const url = new URL(locationUrl);
    url.searchParams.delete("debug-artwork-source");
    return url.href;
}

function bindArtworkRepresentationControl(control, availableIds, selectedId) {
    for (const option of control.options) {
        const available = availableIds.includes(option.value);
        option.disabled = !available;
        option.textContent = available
            ? representationLabel(option.value)
            : `${representationLabel(option.value)} — UNAVAILABLE`;
    }
    control.value = selectedId;
    control.addEventListener("change", () => {
        const url = new URL(window.location.href);
        url.searchParams.set("debug-artwork-source", control.value);
        window.location.assign(url.href);
    }, { once: true });
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
        touchExploration = {
            pointerId: pointer.pointerId,
            startX: pointer.clientX,
            startY: pointer.clientY,
            lastX: pointer.clientX,
            lastTimestamp: pointer.timeStamp,
            displacementScale: application.interactionDisplacementScale(
                width
            ),
            targetX,
            interaction:null,
            project: application.projectAtPresentationX(targetX),
            smoothedVelocity: 0,
            temporaryReveal: 0,
            temporaryDirectionalBias: 0,
            dragLearned: false,
            gestureIntent:"pending",
            clickRevealAllowed
        };
        return true;
    };

    const activateTouchExploration = () => {
        if (!touchExploration) {
            return false;
        }
        if (!touchExploration.interaction) {
            touchExploration.interaction = application.beginTouchExploration(
                touchExploration.targetX
            );
        }
        return Boolean(touchExploration.interaction);
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
            targetXFor(midpointX)
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
        for (const pointer of pointers) {
            canvas.setPointerCapture(pointer.pointerId);
        }
        canvas.classList.add("is-dragging");
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
            if (touchPointers.size === 1) {
                beginTouchExploration(pointer);
            } else {
                beginTouchPinch();
                event.preventDefault();
            }
            return;
        }

        const interaction = application.beginLocalInteraction(
            targetX,
            application.desktopCurtainNeighborReach()
        );
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
            ) * application.desktopCurtainDirectDragScale(),
            interaction,
            project,
            lastX: event.clientX,
            lastTimestamp: event.timeStamp,
            smoothedVelocity: 0,
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
                    ) * touchPinch.displacementScale
                        * TOUCH_CURTAIN_PINCH_DISPLACEMENT_GAIN / 2;
                    application.updateTouchPinch(
                        touchPinch.interaction,
                        separationDisplacement
                    );
                }
                event.preventDefault();
                return;
            }
        }

        if (touchExploration
            && event.pointerId === touchExploration.pointerId) {
            if (touchExploration.gestureIntent === "pending") {
                const totalHorizontalMovement = event.clientX
                    - touchExploration.startX;
                const totalVerticalMovement = event.clientY
                    - touchExploration.startY;
                const horizontalDistance = Math.abs(totalHorizontalMovement);
                const verticalDistance = Math.abs(totalVerticalMovement);
                const gestureIntent = touchGestureIntent(
                    horizontalDistance,
                    verticalDistance
                );
                if (gestureIntent === "vertical") {
                    touchExploration = null;
                    canvas.classList.remove("is-dragging");
                    return;
                }
                if (gestureIntent === "pending") {
                    return;
                }
                if (!activateTouchExploration()) {
                    touchExploration = null;
                    return;
                }
                touchExploration.gestureIntent = "horizontal";
                canvas.setPointerCapture(event.pointerId);
                canvas.classList.add("is-dragging");
            }
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
                conversation.clearProjectSelection();
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

        const incrementalMovement = event.clientX - drag.lastX;
        const elapsed = Math.max(
            1,
            Math.min(
                event.timeStamp - drag.lastTimestamp,
                DESKTOP_CURTAIN_INERTIA_MAXIMUM_SAMPLE_DURATION
            )
        );
        const velocity = incrementalMovement
            * drag.displacementScale / elapsed;
        drag.smoothedVelocity = lowPass(
            drag.smoothedVelocity,
            velocity,
            elapsed,
            DESKTOP_CURTAIN_INERTIA_VELOCITY_SMOOTHING
        );
        drag.lastX = event.clientX;
        drag.lastTimestamp = event.timeStamp;

        const horizontalDisplacement = (
            event.clientX - drag.startX
        ) * drag.displacementScale;
        if (!drag.dragLearned && !isCurtainClick(
            event.clientX - drag.startX,
            event.clientY - drag.startY
        )) {
            drag.dragLearned = true;
            conversation.clearProjectSelection();
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
        const completedDrag = drag.dragLearned;
        const dragReleaseVelocity = drag.smoothedVelocity;
        const clickReveal = allowClickReveal && isCurtainClick(
            event.clientX - drag.startX,
            event.clientY - drag.startY
        );

        drag = null;
        canvas.classList.remove("is-dragging");
        if (clickReveal && grabbedProject) {
            if (application.revealLocalInteraction(grabbedInteraction)) {
                conversation.showDragHint();
            }
        } else if (clickReveal) {
            conversation.showDragHint();
        } else {
            if (allowClickReveal && completedDrag) {
                application.startDesktopCurtainInertia(
                    grabbedInteraction,
                    totalProjectedDisplacement,
                    dragReleaseVelocity
                );
            }
            if (reframeDirection !== 0) {
                application.reframeHorizontal(
                    reframeDirection,
                    grabbedInteraction,
                    synchronizeViewportControl
                );
            }
        }
        if (!clickReveal && completedDrag) {
            conversation.markExplorationInactive();
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
        if (!completed.interaction && !activateTouchExploration()) {
            touchExploration = null;
            return;
        }
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
                synchronizeViewportControl,
                conversation.markExplorationInactive
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
    const curtainScreen = element.closest(".curtain-sticky-stage");
    if (!(conversation instanceof HTMLOutputElement)
        || !(trigger instanceof HTMLButtonElement)
        || !(panel instanceof HTMLElement)
        || !(list instanceof HTMLUListElement)) {
        throw new Error("Conversation interface is incomplete.");
    }

    const title = createTitleTransition(conversation);
    let menuOpen = false;
    let exploredProjectIndex = null;
    let projectSelectionCleared = false;
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
        trigger.textContent = "X";
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
            const projectTitle = document.createElement("span");
            projectTitle.className = "conversation-project-title";
            projectTitle.textContent = project.title;
            const projectYear = document.createElement("span");
            projectYear.className = "conversation-project-year";
            projectYear.textContent = project.year ?? "";
            button.append(projectTitle, projectYear);
            const activeIndex = projectSelectionCleared
                ? null
                : application.attentionMode === "read"
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
        const projectIndex = application.projectNavigation?.projects
            .indexOf(project);
        exploredProjectIndex = Number.isInteger(projectIndex)
            && projectIndex >= 0
            ? projectIndex
            : null;
        projectSelectionCleared = false;
        title.set(project.title);
    };
    const showDragHint = () => {
        // A click outside semantic content does not change visitor context.
    };
    const markDragLearned = () => {
        title.set(EXPLORATION_TITLE);
    };
    const markExplorationInactive = () => {
        title.set(PUBLIC_TITLE);
    };
    const clearProjectSelection = () => {
        if (projectSelectionCleared) {
            return;
        }
        projectSelectionCleared = true;
        synchronizeProjects();
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
    window.addEventListener("scroll", () => {
        if (menuOpen
            && curtainScreen instanceof HTMLElement
            && !containsVisualViewportCenter(curtainScreen)) {
            closeMenu({ restoreFocus: false });
        }
    }, { passive: true });

    synchronizeProjects();
    return Object.freeze({
        synchronizeProjects,
        showProject,
        showDragHint,
        clearProjectSelection,
        markDragLearned,
        markExplorationInactive,
        get title() {
            return title.value;
        }
    });
}

export function containsVisualViewportCenter(element) {
    const bounds = element.getBoundingClientRect();
    const viewportTop = window.visualViewport?.offsetTop ?? 0;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const viewportCenter = viewportTop + viewportHeight / 2;
    return bounds.top <= viewportCenter && bounds.bottom >= viewportCenter;
}

export function createTitleTransition(
    element,
    {
        reducedMotion = window.matchMedia?.(
            "(prefers-reduced-motion: reduce)"
        ).matches === true
    } = {}
) {
    if (!(element instanceof HTMLOutputElement)) {
        throw new TypeError("Title transition requires an output element.");
    }

    let value = element.getAttribute("aria-label")
        ?? element.textContent.trim()
        ?? PUBLIC_TITLE;
    const settle = () => {
        const line = titleLine(value);
        element.replaceChildren(line);
        element.setAttribute("aria-label", value);
    };
    const set = (nextValue) => {
        if (typeof nextValue !== "string" || nextValue === "") {
            throw new TypeError("Conversation title must be non-empty text.");
        }
        if (nextValue === value) {
            return false;
        }
        settle();
        const outgoing = element.firstElementChild;
        value = nextValue;
        element.setAttribute("aria-label", value);
        if (reducedMotion) {
            settle();
            return true;
        }

        outgoing.classList.add("is-outgoing");
        const incoming = titleLine(value);
        incoming.classList.add("is-incoming");
        element.append(incoming);
        incoming.addEventListener("animationend", () => {
            if (incoming.isConnected
                && element.getAttribute("aria-label") === value) {
                settle();
            }
        }, { once: true });
        return true;
    };

    settle();
    return Object.freeze({
        set,
        get value() {
            return value;
        }
    });
}

function titleLine(value) {
    const line = document.createElement("span");
    line.className = "conversation-title-line";
    line.dataset.conversationTitleLine = "";
    line.setAttribute("aria-hidden", "true");
    line.textContent = value;
    return line;
}

export function isCurtainClick(horizontalMovement, verticalMovement) {
    return Math.hypot(horizontalMovement, verticalMovement)
        <= CURTAIN_CLICK_TOLERANCE;
}

export function touchGestureIntent(horizontalDistance, verticalDistance) {
    if (verticalDistance > TOUCH_GESTURE_INTENT_DEAD_ZONE
        && verticalDistance
            > horizontalDistance * TOUCH_VERTICAL_DOMINANCE_RATIO) {
        return "vertical";
    }
    if (horizontalDistance > TOUCH_GESTURE_INTENT_DEAD_ZONE
        && horizontalDistance
            > verticalDistance * TOUCH_HORIZONTAL_DOMINANCE_RATIO) {
        return "horizontal";
    }
    return "pending";
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
const TOUCH_GESTURE_INTENT_DEAD_ZONE = 12;
const TOUCH_VERTICAL_DOMINANCE_RATIO = 1.6;
const TOUCH_HORIZONTAL_DOMINANCE_RATIO = 1.05;
const TOUCH_EXPLORATION_MAXIMUM_SAMPLE_DURATION = 50;
const DESKTOP_CURTAIN_INERTIA_MAXIMUM_SAMPLE_DURATION = 50;
const DESKTOP_CURTAIN_INERTIA_VELOCITY_SMOOTHING = 45;
const TOUCH_CURTAIN_VELOCITY_SMOOTHING = 45;
const TOUCH_CURTAIN_FOLLOW_RATE = 90;
const TOUCH_CURTAIN_VELOCITY_TO_REVEAL = 0.04;
const TOUCH_CURTAIN_MAXIMUM_TEMPORARY_REVEAL = 0.30;
const TOUCH_CURTAIN_VELOCITY_TO_DIRECTIONAL_BIAS = 0.10;
const TOUCH_CURTAIN_DIRECTIONAL_RETENTION = 1.00;
const TOUCH_CURTAIN_DIRECTIONAL_RESISTANCE = 3.00;
const TOUCH_CURTAIN_REVEAL_RETENTION = 0.60;
const TOUCH_CURTAIN_PINCH_DISPLACEMENT_GAIN = 1.50;
const VIEWPORT_INERTIA_GAIN = 1.75;
const VIEWPORT_INERTIA_DAMPING = 4.00;
const TOUCH_CURTAIN_SETTLE_DURATION = 360;
const TOUCH_CURTAIN_INERTIA_DEVELOPMENT_DURATION = 160;
const PUBLIC_TITLE = "LETZEBUERGER KONSCHTPRAIS";
const EXPLORATION_TITLE = "Simone Decker";

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
