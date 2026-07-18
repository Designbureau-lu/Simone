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

        const pixelRatio = window.devicePixelRatio || 1;
        const width = backingExtent(this.#canvas.clientWidth, pixelRatio);
        const height = backingExtent(this.#canvas.clientHeight, pixelRatio);

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

function backingExtent(cssExtent, pixelRatio) {
    return Math.max(1, Math.round(cssExtent * pixelRatio));
}
