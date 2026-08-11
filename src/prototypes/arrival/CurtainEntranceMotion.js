export class CurtainEntranceMotion {
    constructor({
        initialOffset,
        delayProgress,
        offsetRemainingAtSnap,
        snapFlightDuration
    }) {
        this.initialOffset = initialOffset;
        this.delayProgress = delayProgress;
        this.offsetRemainingAtSnap = offsetRemainingAtSnap;
        this.snapFlightDuration = snapFlightDuration;
        this.currentOffset = initialOffset;
        this.targetOffset = initialOffset;
        this.snapStartOffset = null;
        this.snapFollowing = false;
        this.snapFlightElapsed = 0;
        this.complete = false;
        this.lastDelta = 0;
    }

    updateScrollProgress(scrollProgress) {
        if (this.snapFollowing || this.complete) {
            return;
        }
        const movementProgress = normalizedProgress(
            scrollProgress,
            this.delayProgress,
            1
        );
        this.targetOffset = this.initialOffset
            + (this.offsetRemainingAtSnap - this.initialOffset)
                * movementProgress;
        this.#setOffset(this.targetOffset);
    }

    beginNativeSnap() {
        if (this.snapFollowing || this.complete) {
            return;
        }
        this.snapFollowing = true;
        this.snapStartOffset = this.currentOffset;
        this.snapFlightElapsed = 0;
    }

    advance(elapsedMilliseconds) {
        if (!this.snapFollowing || this.complete) {
            return;
        }
        this.snapFlightElapsed = Math.min(
            this.snapFlightElapsed + elapsedMilliseconds,
            this.snapFlightDuration
        );
        const progress = this.snapFlightDuration > 0
            ? this.snapFlightElapsed / this.snapFlightDuration
            : 1;
        this.#setOffset(this.snapStartOffset * (1 - progress));
        if (progress >= 1) {
            this.currentOffset = 0;
            this.targetOffset = 0;
            this.complete = true;
        }
    }

    get needsAdvance() {
        return this.snapFollowing && !this.complete;
    }

    finish() {
        this.currentOffset = 0;
        this.targetOffset = 0;
        this.snapStartOffset = 0;
        this.snapFlightElapsed = this.snapFlightDuration;
        this.complete = true;
        this.lastDelta = 0;
    }

    #setOffset(offset) {
        const previousOffset = this.currentOffset;
        this.currentOffset = offset;
        this.lastDelta = this.currentOffset - previousOffset;
    }
}

function normalizedProgress(value, start, end) {
    if (end <= start) {
        return value >= end ? 1 : 0;
    }
    return Math.min(Math.max((value - start) / (end - start), 0), 1);
}
