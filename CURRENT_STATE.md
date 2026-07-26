# SIMONE Current State

Updated: 2026-07-26

## Today's work

- Replaced Reset Curtain State's instant runtime jump with a cancellable
  600 ms smoothstep reset. Every Period interpolates independently from its
  current Visible Factor to the existing constrained reset target; the final
  frame uses the original exact setter so the settled result is identical to
  the former instant reset. `RESET_CURTAIN_DURATION` is the single timing
  parameter. New curtain interaction, replacement reset, surface update, or
  project navigation cancels an active reset sequence.
- Added a temporary project dropdown as another entry point into the existing
  READ prototype pipeline. Selection first completes an animated Reset to the
  temporary fixed 50% READ-entry target, then calls the same indexed project
  navigator used by NEXT/PREVIOUS. At arrival, the dropdown's selected semantic
  span becomes uniformly fully open from the Period containing `artworkStart`
  through the Period containing `artworkEnd - 1`; surrounding Periods remain
  at the neutral 50% state. This selected-artwork presentation uses its own
  calm 1000 ms `PROJECT_REVEAL_DURATION`, independently of Reset and the
  NEXT/PREVIOUS prototype. Before that presentation, the semantic midpoint
  between `artworkStart` and `artworkEnd` is aligned with the Viewport centre.
  The shared navigator still owns project lookup and positioning, while
  NEXT/PREVIOUS retain their existing alignment and prototype opening.
- Added static manifest loading from `public/images.txt`. SIMONE preserves
  manifest order and filenames, ignores blank/comment lines, and continues
  assembling the curtain when an individual listed image fails to decode.
- Added the semantic project-navigation model independently of navigation UI.
  Project spans load from `public/projects.txt`, accumulate in logical
  Gutter|Column units, and convert to artwork coordinates through centralized
  layout values. Navigation is disabled when spans exceed the capacity implied
  by the number of successfully loaded images.
- Added temporary PREVIOUS/NEXT evaluation controls. They maintain a current
  project index and settle the Viewport at the adjacent project's
  geometry-mapped `artworkStart`, without wrapping or using curtain dragging
  or Invisible Reframing eligibility.
- PREVIOUS/NEXT still settles the Viewport at the geometry-mapped
  `currentProject.artworkStart`. Only after arrival, automatic opening selects
  the Period containing that exact project boundary and begins a one-sided
  interaction with `localPosition = 0` and no left influence. A strong
  rightward drag increases visibility only for the boundary Period and later
  Periods. Its displacement now comes from the selected project's exact
  semantic width, `artworkEnd - artworkStart`, replacing the former fixed
  prototype width.
- Extended the projected Viewport's trailing bound to the rendered content end.
  The curtain's right edge can therefore enter and cross the visible window,
  leaving white space after the artwork regardless of image count, while the
  leading bound remains fixed at the rendered content start.
- Replaced continuous camera following with the current Invisible Reframing
  concept. Dragging changes only the curtain. After a meaningful inward drag
  ends in an outer 20% edge zone, the Viewport may settle by half its visible
  extent toward additional content while the completed curtain state remains
  frozen.
- Rebuilt crest lighting as an isolated feature in both canvas renderers.
  Geometry identifies outward/front regions and the rendered sample
  nearest zero slope, and maximum absolute rendered slope supplies local ridge
  strength. Shading supplies a global linear lifecycle envelope; final crest
  intensity is the product of geometric strength and lifecycle. Rear/down folds
  retain only their valley shading.
- Removed redundant `Period.index` identity and renamed the uniform reference
  configuration to `resetCurtainState` without changing interaction behavior.
- Established a linear influence ramp affecting the nearest
  `CONCERNED_NEIGHBORS` neighboring periods; the current implementation uses
  50 neighbors as its single influence parameter.
- Adopted the viewport-canvas architecture as part of SIMONE. It retains
  virtual curtain geometry and Viewport selection while rendering into a
  CSS-size × DPR backing store.
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

### EXPLORE

The curtain is the visitor's direct-manipulation object. Dragging is the
primary gesture and lets the visitor explore continuously. Projects are
secondary to this free discovery. While the pointer is held, dragging changes
only curtain state and never directly navigates the Viewport.

A local click/Moses opening may later become a secondary magical helper,
probably opening around the clicked position in both directions. It belongs
only to EXPLORE and must not navigate to, isolate, or otherwise depend on a
semantic project. No click prototype has been authorized yet.

### READ

READ begins when the visitor explicitly selects a project, primarily through a
future generous Index overlay. The Index may present project name, date,
curtain position, and alternate sorting orders. Selection expresses an intent
to read, so navigation and reveal are combined.

The selected project should become flat and readable while surrounding curtain
material remains naturally folded and unreadable. Isolation must be produced
by the folds themselves, not blur, fading, darkening, or another graphical
focus effect. Moving between projects will likely refold the previous
selection before revealing the next.

Entering READ will start a fresh reading composition. The previous EXPLORE
curtain state will neither be preserved nor restored. This requires an elegant,
meaningful transition to the neutral folded curtain that communicates “we are
leaving exploration.” Reset is therefore an expressive part of READ entry, not
merely a technical state-restoration function.

```text
Select Project
    ↓
Reset (curtain settles)
    ↓
Move to project
    ↓
Present Project
    ↓
Reading
```

The selected project must flatten across its exact semantic span, from its left
gutter to its right edge. READ must not define presentation as an arbitrary
number of columns. The work is presented, not merely opened. Gentle folds on
both sides should transition between the flat project and the normal dense
curtain.

Animated Reset, movement to the selected project, uniform semantic-span
presentation, semantic project width, and geometric midpoint centering are
implemented. Optical centering, gentle transition folds, and the final reading
composition remain to be designed.

The interaction now feels closer to turning a page in a book than navigating a
website. Closing one work before presenting the next is an intentional part of
the experience.

The current NEXT/PREVIOUS controls and partial automatic opening are temporary
READ-mode experiments. Preserve their useful navigation code, but do not
expand them or treat the present reveal as final interaction design.

### Invisible Reframing

Invisible Reframing is computer assistance, not user navigation. It is
evaluated only after a drag ends, and only when the completed gesture suggests
that the visitor intends to continue exploring beyond the comfortable view.
The completed curtain deformation remains frozen while the Viewport settles.

The current trigger requires:

- a drag starting inside the outer 20% edge zone;
- an inward projected drag exceeding 10% of the visible Viewport width;
- additional projected content in the corresponding direction.

When eligible, the Viewport requests approximately half its visible extent but
limits that distance so it cannot move past the material point selected at
pointer-down. Content bounds may shorten it further. The movement uses a 450 ms
smoothstep settling animation; the normalized Viewport slider and
projected-pixel readout remain synchronized throughout.

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
without changing curtain geometry or interaction state. Its leading bound is
the rendered content start; its trailing bound is the rendered content end, so
navigation can reveal white space beyond the curtain's right edge.

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

These earlier experiments established the viewport-canvas architecture now
used by SIMONE. Further bottleneck isolation and renderer optimization remain
available as later engineering work.

See `PERFORMANCE.md` for the recorded experimental evidence.

## Viewport-canvas architecture

SIMONE renders the unrestricted virtual curtain into a viewport-sized
destination canvas while preserving unlimited curtain interaction and dynamic
curtain width.

In the worst-case Firefox scene, measured performance improved from
approximately 1050 ms per frame with the artwork-width destination canvas to
approximately 100 ms per frame with the viewport-sized destination canvas.
This establishes the architecture as viable and the destination canvas size as
a material part of the worst-case rendering cost.

The viewport-canvas drag coordinate mapping has been verified. Browser pointer
displacement is measured against the canvas content box and converted directly
to the visible projected extent. This is algebraically identical to the
production canvas-coordinate conversion followed by inverse Viewport mapping;
the intermediate canvas backing-store extent cancels. No runtime correction
was required after the existing content-box and drag-mapping fixes.

The viewport-canvas renderer is now the active SIMONE implementation rather
than a separate proof of concept.

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
