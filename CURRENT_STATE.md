# SIMONE Current State

Updated: 2026-07-17

## Stable foundation

- The project separates physical geometry from rendering.
- Artwork is represented by immutable vertical pixel columns.
- The periodic circular-fold model, `CurtainField`, and visibility semantics
  form the current geometry pipeline.

## Viewport

The projected Viewport foundation is implemented in `src/viewport/Viewport.js`
and integrated into the application and renderer.

The Viewport maintains the projected content range and visible projected
window, maps that window to a source-column range, and lets the renderer draw
only the relevant immutable artwork columns. The initial projected window is
established after artwork import and remains independent of the geometry
engine.

Current worktree changes refine Viewport reset and initialization behaviour.
They have not yet been committed as a completed Viewport milestone.

## Performance investigation

A performance overview and frame instrumentation are in progress. The current
worktree measures total frame time and separates CurtainField, geometry,
Viewport, rendering, and overlay work. It also records canvas size,
`drawImage()` calls, visible columns, period count, and scene parameters.

Controlled experiments currently establish:

- Changing source columns from `HTMLImageElement` to `HTMLCanvasElement` does
  not materially change Firefox or Safari performance.
- Destination canvas backing-store width is a first-order performance factor
  in Firefox: the recorded 10000-pixel-wide case was much slower than the
  5000-pixel-wide case.
- Safari was largely insensitive to that width change.
- Chrome remains slow in both width variants; its dominant cost is not yet
  isolated.

No renderer optimization has been selected from these observations. The next
step is a separate controlled Chrome experiment, followed by an optimization
decision based on measurements rather than browser assumptions.

See `PERFORMANCE.md` for the recorded experimental evidence.
