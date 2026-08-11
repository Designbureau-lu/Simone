const DESKTOP_QUERY = "(min-width: 768px)";

export const IDENTITY_BLOB_CONFIG = Object.freeze({
    centerX: Object.freeze({
        left: Object.freeze([28, 42]),
        right: Object.freeze([58, 72])
    }),
    centerY: Object.freeze([38, 60]),
    scaleX: Object.freeze([0.97, 1.03]),
    scaleY: Object.freeze([0.95, 1.05]),
    rotation: Object.freeze([-4, 4]),
    skewX: Object.freeze([-2, 2]),
    scrollRate: 0.90
});

export function startIdentityBlobPresentation() {
    if (!window.matchMedia(DESKTOP_QUERY).matches) {
        return null;
    }
    const blob = document.querySelector("[data-identity-blob]");
    if (!(blob instanceof HTMLElement)) {
        return null;
    }

    const presentation = createIdentityBlobPresentation();
    applyPresentation(blob, presentation);
    let frameId = null;
    const updateScrollSeparation = () => {
        frameId = null;
        const separation = window.scrollY
            * (1 - IDENTITY_BLOB_CONFIG.scrollRate);
        blob.style.setProperty("--blob-scroll-separation", `${separation}px`);
    };
    const scheduleScrollSeparation = () => {
        if (frameId === null) {
            frameId = window.requestAnimationFrame(updateScrollSeparation);
        }
    };
    window.addEventListener("scroll", scheduleScrollSeparation, {
        passive: true
    });
    updateScrollSeparation();
    return Object.freeze({ presentation });
}

export function createIdentityBlobPresentation(random = Math.random) {
    const horizontalSide = random() < 0.5 ? "left" : "right";
    return Object.freeze({
        horizontalSide,
        centerX: randomBetween(
            IDENTITY_BLOB_CONFIG.centerX[horizontalSide],
            random
        ),
        centerY: randomBetween(IDENTITY_BLOB_CONFIG.centerY, random),
        scaleX: randomBetween(IDENTITY_BLOB_CONFIG.scaleX, random),
        scaleY: randomBetween(IDENTITY_BLOB_CONFIG.scaleY, random),
        rotation: randomBetween(IDENTITY_BLOB_CONFIG.rotation, random),
        skewX: randomBetween(IDENTITY_BLOB_CONFIG.skewX, random)
    });
}

function applyPresentation(blob, presentation) {
    blob.style.setProperty("--blob-center-x", `${presentation.centerX}vw`);
    blob.style.setProperty("--blob-center-y", `${presentation.centerY}vh`);
    blob.style.setProperty("--blob-scale-x", presentation.scaleX);
    blob.style.setProperty("--blob-scale-y", presentation.scaleY);
    blob.style.setProperty("--blob-rotation", `${presentation.rotation}deg`);
    blob.style.setProperty("--blob-skew-x", `${presentation.skewX}deg`);
}

function randomBetween([minimum, maximum], random) {
    return minimum + (maximum - minimum) * random();
}
