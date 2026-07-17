/** Maps a virtual curtain frame into the browser-visible canvas backing store. */
export class ViewingSurface {
    #canvas;
    #mode = "viewport";

    constructor(canvas) {
        if (!(canvas instanceof HTMLCanvasElement)) {
            throw new TypeError("ViewingSurface requires a canvas.");
        }

        this.#canvas = canvas;
    }

    set mode(value) {
        if (value !== "dynamic" && value !== "viewport") {
            throw new RangeError("ViewingSurface mode is invalid.");
        }
        this.#mode = value;
    }

    resolve(virtualFrame) {
        if (this.#mode === "dynamic") {
            return Object.freeze({
                frame: virtualFrame,
                scaleX: 1,
                scaleY: 1,
                pixelRatio: window.devicePixelRatio || 1,
                mode: this.#mode
            });
        }

        const bounds = this.#canvas.getBoundingClientRect();
        const pixelRatio = window.devicePixelRatio || 1;
        const width = Math.max(1, Math.round(bounds.width * pixelRatio));
        const height = Math.max(1, Math.round(bounds.height * pixelRatio));

        return Object.freeze({
            frame: Object.freeze({ width, height }),
            scaleX: width / virtualFrame.width,
            scaleY: height / virtualFrame.height,
            pixelRatio,
            mode: this.#mode
        });
    }

    appearanceFor(appearance, scaleX) {
        return Object.freeze({
            ...appearance,
            crestHighlight: Object.freeze({
                ...appearance.crestHighlight,
                minimumWidth: appearance.crestHighlight.minimumWidth * scaleX,
                maximumWidth: appearance.crestHighlight.maximumWidth * scaleX
            })
        });
    }
}
