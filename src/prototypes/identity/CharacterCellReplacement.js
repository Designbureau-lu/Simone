const EMPTY_CELL = "\u00a0";

/** Reusable fixed-cell typographic replacement used by the INDEX reveal. */
export class CharacterCellReplacement {
    #element;
    #cells;
    #source;
    #target;
    #replacementOrder;
    #interval;
    #delay;
    #current = [];
    #delayId = null;
    #intervalId = null;

    constructor({
        element,
        source,
        target,
        replacementOrder = "left-to-right",
        interval = 28,
        delay = 700
    }) {
        if (!(element instanceof HTMLElement)) {
            throw new TypeError("CharacterCellReplacement requires an element.");
        }
        this.#element = element;
        this.#source = normalizeState(source);
        this.#target = normalizeState(target);
        const cellCount = Math.max(this.#source.length, this.#target.length);
        this.#source = padState(this.#source, cellCount);
        this.#target = padState(this.#target, cellCount);
        this.#replacementOrder = replacementOrder;
        this.#interval = interval;
        this.#delay = delay;
        this.#cells = [];
        this.#ensureCellCount(cellCount);
        this.restart();
    }

    get interval() {
        return this.#interval;
    }

    set interval(value) {
        this.#interval = requireNonNegativeNumber(value, "interval");
    }

    get delay() {
        return this.#delay;
    }

    set delay(value) {
        this.#delay = requireNonNegativeNumber(value, "delay");
    }

    restart() {
        this.#cancel();
        const cellCount = this.#cells.length;
        const source = padState(this.#source, cellCount);
        const target = padState(this.#target, cellCount);
        this.#renderState(source);
        this.#startReplacement(
            target,
            resolveOrder(this.#replacementOrder, cellCount),
            this.#delay,
            this.#interval
        );
    }

    replace(target, {
        replacementOrder = "left-to-right",
        interval = this.#interval,
        delay = 0,
        onComplete = null
    } = {}) {
        const normalizedTarget = normalizeState(target);
        const cellCount = Math.max(
            this.#cells.length,
            normalizedTarget.length
        );
        this.#ensureCellCount(cellCount);
        this.#current = padState(this.#current, cellCount);
        const paddedTarget = padState(normalizedTarget, cellCount);
        this.#cancel();
        this.#startReplacement(
            paddedTarget,
            resolveOrder(replacementOrder, cellCount),
            requireNonNegativeNumber(delay, "delay"),
            requireNonNegativeNumber(interval, "interval"),
            onComplete
        );
    }

    #startReplacement(target, order, delay, interval, onComplete = null) {
        this.#delayId = window.setTimeout(() => {
            let orderIndex = 0;
            const replaceNextCell = () => {
                const cellIndex = order[orderIndex];
                this.#renderCell(cellIndex, target[cellIndex]);
                orderIndex += 1;
                if (orderIndex >= order.length) {
                    window.clearInterval(this.#intervalId);
                    this.#intervalId = null;
                    onComplete?.();
                }
            };
            replaceNextCell();
            if (orderIndex < order.length) {
                this.#intervalId = window.setInterval(
                    replaceNextCell,
                    interval
                );
            }
        }, delay);
    }

    #cancel() {
        window.clearTimeout(this.#delayId);
        window.clearInterval(this.#intervalId);
        this.#delayId = null;
        this.#intervalId = null;
    }

    #renderState(state) {
        this.#current = state.slice();
        for (let index = 0; index < this.#cells.length; index += 1) {
            this.#renderCell(index, state[index]);
        }
    }

    #renderCell(index, cellState) {
        const cell = this.#cells[index];
        this.#current[index] = cellState;
        cell.textContent = cellState.character || EMPTY_CELL;
        cell.dataset.weight = cellState.weight;
        this.#element.setAttribute(
            "aria-label",
            this.#cells.map((currentCell) => (
                currentCell.textContent === EMPTY_CELL
                    ? " "
                    : currentCell.textContent
            )).join("").trimEnd()
        );
    }

    #ensureCellCount(cellCount) {
        while (this.#cells.length < cellCount) {
            const cell = document.createElement("span");
            cell.className = "character-cell";
            this.#cells.push(cell);
            this.#element.append(cell);
        }
        this.#element.style.setProperty("--character-cell-count", cellCount);
    }
}

function normalizeState(state) {
    if (typeof state === "string") {
        return Array.from(state, (character) => ({ character, weight: "buch" }));
    }
    return state.flatMap(({ text, weight = "buch" }) => (
        Array.from(text, (character) => ({ character, weight }))
    ));
}

function padState(state, cellCount) {
    return Array.from({ length: cellCount }, (_, index) => (
        state[index] ?? { character: "", weight: "buch" }
    ));
}

function resolveOrder(order, cellCount) {
    let resolved;
    if (order === "left-to-right") {
        resolved = Array.from({ length: cellCount }, (_, index) => index);
    } else if (typeof order === "function") {
        resolved = order(cellCount);
    } else if (Array.isArray(order)) {
        resolved = order.slice();
    } else {
        throw new TypeError("Unsupported character replacement order.");
    }
    const unique = resolved.filter((index, position) => (
        Number.isInteger(index)
        && index >= 0
        && index < cellCount
        && resolved.indexOf(index) === position
    ));
    for (let index = 0; index < cellCount; index += 1) {
        if (!unique.includes(index)) {
            unique.push(index);
        }
    }
    return unique;
}

function requireNonNegativeNumber(value, name) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) {
        throw new RangeError(`${name} must be a non-negative number.`);
    }
    return number;
}
