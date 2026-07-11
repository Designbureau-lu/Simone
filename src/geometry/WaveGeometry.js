/**
 * Geometry layer: calculates where an artwork column is placed.
 *
 * The current linear mapping preserves the prototype's behavior. A periodic
 * wave function will replace this placeholder without changing artwork or
 * rendering modules.
 */
export class WaveGeometry {
    constructor({ horizontalScale = 0.9 } = {}) {
        this.horizontalScale = horizontalScale;
        Object.freeze(this);
    }

    mapColumn(column) {
        return Object.freeze({
            x: column.sourceX * this.horizontalScale,
            y: 0
        });
    }
}
