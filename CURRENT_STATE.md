# SIMONE Current State

Updated: 2026-07-17

## Today's work

- Continued refining the projected Viewport integration and its reset and
  initialization behaviour.
- Added work-in-progress frame instrumentation and a developer performance
  overview for separating geometry, Viewport, rendering, and overlay costs.
- Recorded controlled cross-browser experiments in `PERFORMANCE.md`.
- Established feature-scoped Codex threads and repository documentation as the
  durable project-memory workflow.

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

## Next recommended engineering tasks

1. Run a controlled Chrome experiment that varies one rendering factor at a
   time and isolates its dominant multi-image cost.
2. Verify the Viewport reset and initialization changes with artwork imports,
   changes of projected position, and content wider than the visible window.
3. Review the current worktree as one coherent implementation, then commit the
   Viewport refinements and performance instrumentation separately where
   practical.
4. Select a renderer optimization only after the browser measurements identify
   the relevant bottleneck; preserve immutable artwork columns and the
   geometry/rendering boundary.
5. Establish repeatable benchmark scenes and record browser, hardware, canvas
   dimensions, image count, visible columns, and timings in `PERFORMANCE.md`.

## Codex workflow transition

Normal development is moving from API-key authentication to ChatGPT Plus
authentication. API access may remain available as a controlled fallback for
exceptional high-volume work or capabilities outside the normal interactive
workflow.

The initial development period produced approximately:

- 1 persistent Codex thread
- 170 user turns
- 78.32 million input tokens
- 73.74 million cached input tokens, or 94.2% of input
- 4.57 million new, non-cached input tokens
- 344,000 output tokens
- $100 in API cost over five days

The engineering lesson is that long-lived conversations are expensive because
each turn repeatedly processes accumulated context, even when most of that
context is cached. Future work must use one Codex thread per coherent feature
or investigation. `AGENTS.md`, `CURRENT_STATE.md`, and the relevant sections of
`ARCHITECTURE.md` serve as the project's long-term memory between threads.
