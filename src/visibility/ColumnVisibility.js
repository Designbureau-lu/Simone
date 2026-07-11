/**
 * Visibility layer: decides whether a geometrically mapped column is shown.
 *
 * The step rule reproduces the prototype. Later this module can use wave
 * orientation, viewer position, and occlusion without touching source pixels.
 */
export class ColumnVisibility {
    constructor({ visibleStep = 2 } = {}) {
        this.visibleStep = visibleStep;
        Object.freeze(this);
    }

    isVisible(column, placement) {
        // Placement is accepted now as part of the stable visibility contract.
        void placement;
        return column.sourceX % this.visibleStep === 0;
    }

    appearanceFor(column, placement) {
        // Future visibility models may return opacity or shading metadata here.
        void column;
        void placement;
        return Object.freeze({ opacity: 1 });
    }
}
