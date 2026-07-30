# SIMONE Current State

Updated: 2026-07-30

## Today's work

- Added two-finger direct-touch Pinch as persistent global curtain openness.
  `touchCurtainGlobalOpenness` stores the baseline independently from the
  existing per-Period local deformation. Pinch applies one clamped uniform
  delta to a captured factor snapshot, so opening or closing preserves local
  directional differences and never changes Viewport position or artwork
  scale. `TOUCH_CURTAIN_PINCH_SENSITIVITY = 1.00` maps a full presentation-width
  distance change to one Visible Factor. A second touch changes Pan into Pinch;
  lifting either pinch touch immediately begins a fresh Pan from the remaining
  finger. Existing `touch-action: none` prevents browser page scaling.
- Replaced the curtain-only momentum experiment with bounded Viewport inertia.
  A fast direct-touch release continues the finger-derived camera movement with
  `velocity * VIEWPORT_INERTIA_GAIN * elapsed`, damping velocity through
  `exp(-VIEWPORT_INERTIA_DAMPING * elapsedSeconds)`. While the Viewport moves,
  the existing temporary reveal and directional response continue to follow
  that velocity while the retained target develops exponentially over
  `TOUCH_CURTAIN_INERTIA_DEVELOPMENT_DURATION`. This makes the retained shape
  essentially complete before the camera reaches its stop threshold; the
  unchanged cubic settlement then finishes continuously and exactly. The
  diagnostic settings are gain `1.75`, damping `4.00`, and curtain development
  duration `160` ms. No separate curtain force survives the camera, and there
  is no bounce, rubber-banding, oscillation, or desktop-path change.
- Retained touch settlement now keeps
  `TOUCH_CURTAIN_REVEAL_RETENTION = 0.60` of the symmetric local opening in
  addition to the existing retained directional redistribution. The remaining
  opening still closes through the same travelling inertia response and
  360 ms cubic settlement, but a strong reveal no longer returns its touched
  centre to the captured pre-gesture factor. The nonlinear directional
  resistance remains unchanged.
- Replaced linear retained touch accumulation with an exponential resistance
  curve. A retained directional force now moves each affected Period through a
  fraction of its remaining distance toward the relevant configured limit:
  `1 - exp(-resistance * |force| / factorRange)`. This makes strong movement
  easy around the neutral state while repeated gestures approach 20% or 100%
  asymptotically without a hard ceiling. Reversing direction immediately uses
  the larger distance toward the opposite limit. The current diagnostic tuning
  is `TOUCH_CURTAIN_DIRECTIONAL_RESISTANCE = 3.00`.
- Added experimental full retention of the temporary touch response's
  directional component. Release keeps the existing cubic settlement, removes
  the symmetric reveal and touched-centre opening completely, and settles the
  left/right bias toward `TOUCH_CURTAIN_DIRECTIONAL_RETENTION = 1.00`.
  The retained, constrained Period factors become the captured base for the
  next gesture, so repeated drags accumulate and opposite drags can undo them.
- Extended the temporary direct-touch curtain response with a signed directional
  component while retaining the exaggerated symmetric diagnostic reveal. The
  touched Period remains open; a leftward gesture temporarily compresses the
  left side and opens the right, while a rightward gesture mirrors that bias.
  Both components use the existing local influence falloff, anchor compensation,
  and cubic settlement. Directional strength is isolated in
  `TOUCH_CURTAIN_VELOCITY_TO_DIRECTIONAL_BIAS`.
- Introduced the first distinct direct-touch EXPLORE interaction. Mouse and pen
  retain the established desktop curtain drag, while one touch now moves the
  existing projected Viewport continuously and immediately with no threshold,
  steps, or delayed reframing. A small velocity-smoothed local reveal
  follows the movement with a bounded low-pass delay, remains anchored so its
  geometry change cannot pull the artwork away from the finger. Later
  iterations added camera inertia, retained deformation, and global Pinch
  without changing this direct finger attachment.
- Replaced the giant artwork assembly canvas with a continuous virtual artwork
  coordinate system over the ordered decoded source images. Global column
  coordinates, semantic project mapping, viewport navigation, and scrolling
  remain unchanged; each rendered column now resolves directly to its source
  image and local source coordinate. Production no longer allocates the former
  60,000 × 2,500 intermediate canvas.
- Replaced the active camera's fixed 5000-unit width with an aspect-derived
  projected extent based on artwork height and the rendered curtain container.
  Portrait therefore shows a narrower window without horizontal compression,
  while landscape shows a wider window at the same visual scale. Camera-centre
  continuity, semantic navigation, and slider synchronization are preserved
  across container, orientation, and `visualViewport` size changes. The
  curtain height uses dynamic viewport units with the existing `vh` fallback.
- Consolidated `?debug=1` tools into one fixed, scrollable bottom-right
  development panel. Its single-column order is the five canonical surface
  controls, Viewport information, and permanently visible Performance
  information. Reset Curtain State remains the original frequently used slider
  and no separate Reset control is present. Closing leaves only a small Debug
  reopen control; both remain completely absent from layout and hit-testing
  without debug mode. Temporary NEXT/PREVIOUS markup remains hidden for
  compatibility and is no longer part of the panel.
- Established the current tuning as SIMONE's canonical startup and full-Reset
  defaults: 20% minimum visibility, 100% maximum visibility, 50% Reset Curtain
  State, 120 mm carrier distance, and 50% model transition. The hidden debug
  controls expose the same initial values through `?debug=1`.
- Fixed crest highlights disappearing after the first genuine drag. The drag
  correctly changed local Period geometry but also left the grabbed Period's
  Visible Factor in the frame-wide `sceneVisibleFactor`; reaching the open
  limit therefore set the global crest lifecycle to zero. Crest lifecycle is
  now resolved from each Period's local surface parameters and passed with its
  columns to the existing renderer cue pass. Gradient tuning and render-pass
  lifecycle are unchanged.
- Profiled the production cold-start path in two clean Firefox processes before
  further Moses work. No image/network work, WebGL setup, canvas resize, or
  meaningful selection cost occurs during the first drag. The initial and first
  interactive renders instead pay unusually high costs in the same full
  geometry and Canvas 2D loops used by later frames. A clean headed trace
  isolates most of the cold penalty in the thousands of narrow `drawImage()`
  calls sourced from the 60,000-column assembly canvas; geometry-loop warm-up
  is secondary. `importArtwork()` currently performs only one production render
  before interaction. A bounded set of unchanged, awaited pre-interaction
  render passes is the smallest candidate warm-up. No optimization has been
  applied. Measurements and evidence are recorded in `PERFORMANCE.md`.
- Completed and removed the experimental renderer warm-up. Production again
  performs only its normal initial render and makes interaction available
  immediately afterward. All warm-up pass counts, animation-frame sequencing,
  and interaction gating have been removed; the investigation measurements
  remain in `PERFORMANCE.md`.
- Completed that deformation-state comparison. One strong local deformation
  plus restoration did not help. Twenty identical neutral production renders
  reduced first-drag rendering to 40 ms median / 43 ms p95, matching warmed
  interaction. Different curtain states are not required; the smallest state
  set is the neutral curtain alone. The remaining investigation is the minimum
  identical pass count between the insufficient two and sufficient twenty.
  Measurement-only variants were removed and no warm-up ships in production.
- Bounded identical-pass profiling tested 4, 8, 12, 16, and 20 passes in clean
  headed Firefox profiles at DPR 2. Twelve is the first count whose first-drag
  rendering median/p95 (42/47 ms) matches the warmed range. Eight still has a
  422 ms p95 hitch; sixteen and twenty add no interaction benefit. Twelve costs
  approximately 5.4 seconds of non-interactive startup on the measured machine,
  so it is the technical recommendation but requires an intentional loading
  treatment. The warm-up was subsequently removed from production.
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
  between `artworkStart` and `artworkEnd` is aligned with the Viewport centre,
  then the independent `READ_CENTER_OFFSET` applies a 40 projected-pixel
  optical correction. The shared navigator still owns project lookup and
  positioning, while NEXT/PREVIOUS retain their existing alignment and
  prototype opening.
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

Desktop and direct-touch exploration now express different visitor intentions
through one rendering architecture. With a mouse or pen, the curtain remains
the direct-manipulation object: dragging changes only curtain state and never
directly navigates the Viewport. With one direct-touch pointer, the artwork is
the primary object: movement pans the bounded Viewport continuously while a
subtle velocity-driven curtain response follows temporarily. Projects remain
secondary to free discovery in both cases.

The touch camera is attached to every finger delta without a threshold,
predefined step, or post-gesture reframe. The secondary curtain contribution
is computed over a captured persistent base state, follows through a bounded
first-order delay, and settles without bounce or oscillation. Camera inertia
continues the same velocity-derived response after a fast release. Two-finger
Pinch changes a separate global openness baseline while preserving local
deformation, and never zooms the artwork or moves the camera.

A local click/Moses helper is implemented exclusively for EXPLORE. A click
within a 5 CSS-pixel movement tolerance and on a semantic project starts a
finite, symmetric local opening at that physical position. It uses the earlier
restrained six-Period propagation, 220 ms opening, 140 ms hold, and 1200 ms
cubic ease-out settling envelope, leaving an 8% fold reserve at maximum
opening. The clicked
point stays anchored while the material gently opens outward, then the exact
captured Period factors and Viewport offset are restored. Starting a drag
cancels an unfinished Moses response and restores that snapshot before direct
manipulation begins.

The temporary click-position bubbles, cartel, text timers, and “Read more”
control have been removed. A persistent black conversation bar now sits
independently above the curtain. It begins with “SIMONE”; a semantic click
immediately replaces that with the real project title. A non-project click may
show “Drag me” only before a project title has been presented and before the
visitor has demonstrated a genuine drag. Project titles take priority.

The bar's menu renders the semantic projects in manifest order, highlights the
current project, and sends a selection through the existing Reset-and-READ
pipeline. It closes with its × trigger, Escape, or selection and restores
trigger focus after an explicit close. Its state controller is independent of
the current desktop top-edge CSS so a later breakpoint can relocate it.

Normal presentation hides all technical controls through one `?debug=1`
switch. The curtain fills the remaining viewport beneath the bar without its
former border or demo framing. Beginning any curtain interaction explicitly
returns the application from READ to EXPLORE; this clears the stale mode state
that previously caused later semantic Moses clicks to be rejected.

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
presentation, semantic project width, geometric midpoint centering, and one
uniform configurable optical-centering offset are implemented. Gentle
transition folds and the final reading composition remain to be designed.

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
established after artwork import. Its width is derived from artwork height and
the rendered viewing-surface aspect ratio, then updated around the current
camera centre when that container changes size. It remains independent of the
geometry engine.

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
