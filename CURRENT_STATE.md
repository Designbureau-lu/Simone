# SIMONE Current State

Updated: 2026-07-22

## Today's work

- Replaced continuous camera following with the current Invisible Reframing
  concept. Dragging changes only the curtain. After a meaningful inward drag
  ends in an outer 20% edge zone, the Viewport may settle by half its visible
  extent toward additional content while the completed curtain state remains
  frozen.
- Rebuilt crest lighting as an isolated renderer feature in production and
  Model C. Geometry identifies outward/front regions and the rendered sample
  nearest zero slope, and maximum absolute rendered slope supplies local ridge
  strength. Shading supplies a global linear lifecycle envelope; final crest
  intensity is the product of geometric strength and lifecycle. Rear/down folds
  retain only their valley shading.
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

## Interaction philosophy

### Curtain

The curtain is the visitor's direct-manipulation object. Dragging opens the
curtain and lets the visitor reveal and discover exhibition content. It never
directly navigates the Viewport: while the pointer is held, only curtain state
changes and the Viewport remains stationary.

### Invisible Reframing

Invisible Reframing is computer assistance, not user navigation. It is
evaluated only after a drag ends, and only when the completed gesture suggests
that the visitor intends to continue exploring beyond the comfortable view.
The completed curtain deformation remains frozen while the Viewport settles.

The current trigger requires:

- a drag starting inside the outer 20% edge zone;
- an inward projected drag exceeding 10% of the visible Viewport width;
- additional projected content in the corresponding direction.

When eligible, the Viewport moves by approximately half its visible extent,
shortened at content bounds, using a 450 ms smoothstep settling animation. The
normalized Viewport slider and projected-pixel readout remain synchronized
during the movement.

These trigger heuristics are intentionally provisional. Their thresholds and
gesture interpretation are expected to evolve through observation and visitor
testing rather than being treated as a final navigation specification.

## Viewport

The projected Viewport foundation is implemented in `src/viewport/Viewport.js`
and integrated into the application and renderer.

The Viewport maintains the projected content range and visible projected
window, maps that window to a source-column range, and lets the renderer draw
only the relevant immutable artwork columns. The initial projected window is
established after artwork import and remains independent of the geometry
engine.

The Viewport also supports bounded horizontal settling for Invisible Reframing
without changing curtain geometry or interaction state.

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

The project is now in the **equivalence phase**. Future work focuses on matching
production behaviour and visible output, not on further performance
optimization.

## Next recommended engineering tasks

1. Match the production Viewport height and vertical mapping.
2. Restore production-equivalent artwork crispness.
3. Validate visual and interaction equivalence across representative artwork
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
