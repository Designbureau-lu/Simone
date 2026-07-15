/**
 * Geometry placement contract returned by `mapColumn()`:
 *
 * - `sourceX`: geometry-owned source-column coordinate; used for diagnostics.
 * - `targetX`: geometry-owned horizontal destination coordinate; the
 *   application compares adjacent values to derive rasterized column width.
 * - `targetY`: geometry-owned vertical destination coordinate; consumed by
 *   the renderer without reinterpretation.
 * - `localSlope`: geometry-owned analytical surface slope; consumed by the
 *   renderer's fold-region/crest detection and available to shading models.
 * - `branch`: geometry-owned identity. `front` is the viewer-facing fold and
 *   `rear` is the opposing fold behind it. The application and renderer use it
 *   to preserve fold boundaries and apply branch-specific appearance.
 * - `alpha`: geometry-supplied branch visibility state; passed unchanged by
 *   the application and consumed only by the renderer.
 * - `allocatedWidth`: geometry-owned projected chord width for the selected
 *   branch; reserved for geometry-aware consumers and diagnostics.
 *
 * Shading never mutates placement. Resolved surface parameters own the shared
 * `foldProgress`; shading owns `brightness` and the frame-level
 * Rear/crest/valley appearance settings. The application
 * forwards geometry's `alpha`, `branch`, and `localSlope` alongside shading's
 * `brightness`; it derives renderer `x`, `y`, and `width` from adjacent geometry
 * placements. The renderer assumes placements arrive in immutable
 * artwork-column order. It identifies fold boundaries from branch changes and
 * from the documented Front/Rear slope-direction reset.
 *
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
