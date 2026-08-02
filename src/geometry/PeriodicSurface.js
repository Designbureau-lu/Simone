/**
 * Geometry placement contract returned by `mapColumn()`:
 *
 * - `sourceX`: geometry-owned source-column coordinate; used for diagnostics.
 * - `periodIndex`: geometry-owned CurtainField Period identity; used by the
 *   application to select local resolved parameters for shading.
 * - `targetX`: geometry-owned horizontal destination coordinate; the
 *   application compares adjacent values to derive rasterized column width.
 * - `targetY`: geometry-owned vertical fold offset. The application preserves
 *   its former lower edge while applying the optional depth-height mapping.
 * - `depthFromFront`: current physical distance behind the Period's frontmost
 *   crest. It collapses toward zero as the fold becomes flat.
 * - `referenceMaximumDepth`: stable physical depth bound for that fold model.
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
 * Shading never mutates placement. Each Period's resolved surface parameters
 * own its `foldProgress`; shading owns `brightness`, the local crest lifecycle,
 * and the frame-level Rear/crest/valley appearance settings. The application
 * forwards geometry's `alpha`, `branch`, and `localSlope` alongside shading's
 * local `brightness`, `foldProgress`, and crest lifecycle; it derives renderer
 * `x`, `y`, and `width` from adjacent geometry placements. The renderer assumes placements
 * arrive in immutable
 * artwork-column order. It identifies fold boundaries from branch changes and
 * from the documented Front/Rear slope-direction reset.
 *
 * Geometry-only contract for periodic surface implementations.
 *
 * A surface resolves the global Period layout, locates Periods intersecting a
 * projected window, and maps requested globally indexed artwork columns. It
 * has no knowledge of rendering, shading, visibility, or the UI.
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

    frameFor(artwork, curtainField) {
        void artwork;
        void curtainField;
        throw new Error("PeriodicSurface.frameFor() must be implemented.");
    }

    mapColumn(column, curtainField) {
        void column;
        void curtainField;
        throw new Error("PeriodicSurface.mapColumn() must be implemented.");
    }

    samplingRangeForProjectedWindow(start, end, guardPeriods = 0) {
        void start;
        void end;
        void guardPeriods;
        throw new Error(
            "PeriodicSurface.samplingRangeForProjectedWindow() "
                + "must be implemented."
        );
    }
}
