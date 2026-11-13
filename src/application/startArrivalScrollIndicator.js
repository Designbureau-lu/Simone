// Kept independent of the curtain application and museum content/translation files.
const indicator = document.querySelector(".arrival-scroll-indicator");
const nextSection = document.getElementById("curtain-stage");

if (indicator && nextSection) {
    indicator.addEventListener("click", (event) => {
        // Preserve native modified-click navigation and the anchor fallback.
        if (event.button !== 0 || event.metaKey || event.ctrlKey
            || event.shiftKey || event.altKey) {
            return;
        }
        event.preventDefault();
        const reducedMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches;
        nextSection.scrollIntoView({
            behavior: reducedMotion ? "instant" : "smooth",
            block: "start"
        });
    });
}
