const MOBILE_QUERY = "(max-width: 767px)";

export const IDENTITY_BLOB_CONFIG = Object.freeze({
    desktop: Object.freeze({
        centerX: Object.freeze({
            left: Object.freeze([28, 42]),
            right: Object.freeze([58, 72])
        }),
        centerY: Object.freeze([38, 60])
    }),
    mobile: Object.freeze({
        centerX: Object.freeze({
            left: Object.freeze([24, 38]),
            right: Object.freeze([62, 76])
        }),
        centerY: Object.freeze([38, 60])
    }),
    scaleX: Object.freeze([0.97, 1.03]),
    scaleY: Object.freeze([0.95, 1.05]),
    rotation: Object.freeze([-4, 4]),
    skewX: Object.freeze([-2, 2]),
    scrollRate: 0.90
});

export function startIdentityBlobPresentation() {
    const blob = document.querySelector("[data-identity-blob]");
    if (!(blob instanceof HTMLElement)) {
        return null;
    }

    const layout = window.matchMedia(MOBILE_QUERY).matches
        ? "mobile"
        : "desktop";
    const presentation = createIdentityBlobPresentation(
        Math.random,
        layout
    );
    applyPresentation(blob, presentation);
    let frameId = null;
    let previousScrollY = window.scrollY;
    let upwardStart = null;
    const updateScrollSeparation = () => {
        frameId = null;
        const scrollY = window.scrollY;
        if (layout === "mobile" && scrollY < previousScrollY) {
            upwardStart ??= Object.freeze({
                scrollY: previousScrollY,
                separation: previousScrollY
                    * (1 - IDENTITY_BLOB_CONFIG.scrollRate)
            });
        } else if (scrollY >= previousScrollY) {
            upwardStart = null;
        }
        const separation = upwardStart
            ? mobileUpwardScrollSeparation(
                upwardStart,
                scrollY,
                IDENTITY_BLOB_CONFIG.scrollRate
            )
            : scrollY * (1 - IDENTITY_BLOB_CONFIG.scrollRate);
        blob.style.setProperty("--blob-scroll-separation", `${separation}px`);
        previousScrollY = scrollY;
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

export function mobileUpwardScrollSeparation(
    start,
    scrollY,
    scrollRate = IDENTITY_BLOB_CONFIG.scrollRate
) {
    if (start.scrollY <= 0) {
        return 0;
    }
    const progress = Math.min(
        1,
        Math.max(0, (start.scrollY - scrollY) / start.scrollY)
    );
    const easedProgress = progress * progress * (3 - 2 * progress);
    return start.separation
        + start.scrollY * scrollRate * easedProgress
        - start.scrollY * progress;
}

export function createIdentityBlobPresentation(
    random = Math.random,
    layout = "desktop"
) {
    const layoutConfig = IDENTITY_BLOB_CONFIG[layout]
        ?? IDENTITY_BLOB_CONFIG.desktop;
    const horizontalSide = random() < 0.5 ? "left" : "right";
    return Object.freeze({
        horizontalSide,
        centerX: randomBetween(
            layoutConfig.centerX[horizontalSide],
            random
        ),
        centerY: randomBetween(layoutConfig.centerY, random),
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
