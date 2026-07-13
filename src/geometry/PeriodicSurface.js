/**
 * Geometry-only contract for periodic surface implementations.
 *
 * A surface computes frame bounds and the placement of immutable artwork
 * columns. It has no knowledge of rendering, shading, visibility, or the UI.
 *
 * Planned implementations: LinearGather, RoundedFold, FigureEightFold, and
 * MeasuredSurface. They remain names only until their geometry is specified.
 */
export class PeriodicSurface {
    constructor() {
        if (new.target === PeriodicSurface) {
            throw new TypeError("PeriodicSurface is an abstract geometry contract.");
        }
    }

    frameFor(artwork, parameters) {
        void artwork;
        void parameters;
        throw new Error("PeriodicSurface.frameFor() must be implemented.");
    }

    mapColumn(column, parameters) {
        void column;
        void parameters;
        throw new Error("PeriodicSurface.mapColumn() must be implemented.");
    }
}
