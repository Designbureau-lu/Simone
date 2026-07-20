# SIMONE Current State

Updated: 2026-07-18

## Today's work

- Removed redundant `Period.index` identity and renamed the uniform reference
  configuration to `resetCurtainState` without changing interaction behavior.
- Established a linear influence ramp affecting the nearest
  `CONCERNED_NEIGHBORS` neighboring periods; the current implementation uses
  50 neighbors as its single influence parameter.
- Evaluated the temporary Model C proof of concept on the
  `model-c-viewport-canvas-poc` branch. Model C is architecturally viable: it
  retains virtual curtain geometry and Viewport selection while rendering into
  a CSS-size × DPR backing store.
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

These earlier experiments led to the Model C architectural proof of concept.
Further bottleneck isolation and renderer optimization are deferred while the
project establishes Model C equivalence with production.

See `PERFORMANCE.md` for the recorded experimental evidence.

## Model C proof-of-concept outcome

Model C demonstrated that SIMONE can render the unrestricted virtual curtain
into a viewport-sized destination canvas without changing the production
renderer. Unlimited curtain interaction and dynamic curtain width were
preserved.

In the worst-case Firefox scene, measured performance improved from
approximately 1050 ms per frame with the artwork-width destination canvas to
approximately 100 ms per frame with the viewport-sized destination canvas.
This establishes the architecture as viable and the destination canvas size as
a material part of the worst-case rendering cost.

The Model C drag coordinate mapping has now been verified. Browser pointer
displacement is measured against the canvas content box and converted directly
to the visible projected extent. This is algebraically identical to the
production canvas-coordinate conversion followed by inverse Viewport mapping;
the intermediate canvas backing-store extent cancels. No runtime correction
was required after the existing content-box and drag-mapping fixes.

The prototype is not yet equivalent to production. Remaining differences are:

- the Viewport height does not match production;
- rendered artwork has reduced crispness;
- the crest highlight has a fade bug.

The project is now in the **equivalence phase**. Future work focuses on matching
production behaviour and visible output, not on further performance
optimization.

## Next recommended engineering tasks

1. Match the production Viewport height and vertical mapping.
2. Restore production-equivalent artwork crispness.
3. Correct the crest-highlight fade without changing geometry or artwork.
4. Validate visual and interaction equivalence across representative artwork
   widths and curtain states before considering production integration.

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
