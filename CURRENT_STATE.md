# SIMONE Current State

Updated: 2026-08-13

## Desktop milestone

- Below 768 px, Screen 1 uses `100dvh` and the Curtain uses `100svh`; both are
  ordinary-flow native snap targets in the single root `y proximity` scroller.
  The Curtain stage and its Hero presentation share the small viewport height
  so Safari chrome changes do not resize the curtain. The
  curtain is not sticky. It reuses the desktop
  presentation-level entrance choreography; after landing, the existing mobile
  touch lifecycle is authoritative. Its canvas uses `touch-action: pan-y` and
  waits through a 12 px dead zone before pointer capture. Vertical intent
  requires `1.6×` dominance; horizontal intent requires `1.05×` dominance.
  Pending moves remain native and unprevented, so intentional vertical gestures
  stay native while horizontal drag and two-touch pinch retain their custom
  paths.
  The live identity shares the desktop-authoritative Buch artist,
  Extraleicht prize letters, and Buch `20`/`26` rules. Its title is a dedicated
  mobile intrinsic two-column composition with the desktop-authoritative
  `0.8ch` internal gap. The complete typographic object—not its individual
  blocks—is centered and its font size is derived from its combined monospace
  width to span symmetric 24 px edges. It uses neither equal columns nor
  independently anchored viewport edges. All identity text lives in a
  normal-scroll content layer; only its sibling blob presentation receives
  parallax. The authored blob receives one stable side-biased
  random pose per load and the same restrained `0.90` scroll-rate separation as
  desktop. Touch physics, Index panel contents, and lower editorial layout are
  unchanged.

- The permanent development panel reports the active mobile/desktop layout,
  CSS viewport dimensions, device pixel ratio, computed production identity
  families and weights, and frame-performance information. Its permanent
  `CAPTURE 5s` control records the existing renderer reports for five seconds,
  then freezes a real-device browser, viewport, Canvas, timing, missed-frame,
  and workload summary for photographing without remote debugging. The isolated font
  specimen and its DEV-only faces/loading probes have been removed; production
  identity font files and rules remain authoritative.

- The page has three normal-flow parts: a `100dvh` live identity screen, the
  existing curtain inside a `200dvh` sticky stage, and the semantic exhibition
  information article. Root scrolling uses `y proximity`; Screen 1 and the
  curtain stage align at `start`, and Screen 1 retains `scroll-snap-stop:
  always`. The curtain canvas, geometry, camera, artwork, interaction, and
  rendering remain the approved production implementation.
- Desktop identity typography uses Söhne Mono evaluation fonts with
  `--color-text: #3c3c3c`, `--type-display: clamp(4rem, 5vw, 6rem)`,
  `--type-section: clamp(2.5rem, 3.2vw, 4rem)`, shared information token
  `--type-information: 1.4rem`, and `--page-margin: 150px`. Date and venue now
  occupy equal flexible rows above and below the centered title, keeping each
  geometrically centered in the surrounding free space on desktop and mobile.
- `assets/blop.svg` is presented unchanged behind the Screen 1 title. A stable
  desktop per-load pose chooses a left `28–42vw` or right `58–72vw` center;
  mobile uses left `24–38vw` or right `62–76vw`. Both use a `38–60vh` vertical
  center. Procedural pose ranges are scaleX `0.97–1.03`,
  scaleY `0.95–1.05`, rotation `-4–4deg`, and skewX `-2–2deg`. Its asymmetric
  10-second breath scales `0.975–1.025`, drifts within about ±8 px horizontally
  and ±6 px vertically, and does not animate rotation. The blob travels at 90%
  of page scroll speed; the pose is not rerandomized on scroll or resize.
- The curtain entrance starts at `1.10` viewport widths with a 4% scroll dead
  zone and a `0.55` viewport-width pre-flight target. At sticky-stage alignment,
  an independent 280 ms linear flight reaches exact zero. Curtain factors stay
  at `0.85` during travel. Impact immediately starts captured visible Periods
  settling left-to-right with a 12 ms start stagger and 600 ms `easeOutCubic`
  duration; `sceneVisibleFactor` settles globally. The complete captured
  snapshot is restored before interaction unlocks. INDEX reveals 200 ms later,
  one fixed cell every 35 ms. No Scroll Snap Event drives application state.
- The desktop curtain header is 96 px high. INDEX uses the shared `1.4rem` Söhne Mono Buch
  at a 40 px left inset and a 12 px optical downward adjustment. Its content box
  is `min(620px, 100%)`; the open `X` is 40 px inside that box's right edge.
  Project rows are uppercase, 56 px minimum height, padded 10 px vertically and
  `40px` / `32px` horizontally, with `1.4rem` / `1.2` typography. Rows use
  Extraleicht normally and Buch for hover or selection, without markers or
  background highlights. Genuine visitor curtain movement clears only the
  visual project selection. The reusable `CharacterCellReplacement` utility is
  active only for the one-shot INDEX reveal and exposes no global API.
- Desktop mouse/pen interaction uses direct drag scale `0.5`, 45 ms incremental
  velocity smoothing, inertia gain `1.0`, damping `5.0`, stop threshold `0.01`,
  and a 32 ms RAF delta clamp. The captured interaction reaches 40 Periods per
  side with grabbed participation `0.08`; the grabbed Period opens symmetrically
  while neighbor redistribution remains directional. Desktop camera reframing
  remains independent at 550 ms with smootherstep and no overshoot.
- The lower article uses semantic sections rather than positioned PDF
  reconstruction. Editorial titles are right-aligned Söhne Mono Buch with
  explicit authored lines; related pills occupy the same right column. Noi
  Grotesk Light body copy occupies the left half at desktop `--type-body: 1.5rem`,
  line-height `1.45`, and `min(50vw, 56rem)` reading width. Pill labels are
  `0.85rem` inside unchanged 48 px minimum-height pill boxes. Exhibition and
  opening remain two centered information blocks and both use line-height
  `1.5`. The semantic footer retains `assets/logos.svg`, address,
  phone, email, and visit action.
- Rear valley shadows group one continuous Rear branch across its internal
  zero-slope crossing. Front/Rear and Period boundaries still split regions;
  cue strengths, geometry, structural height, and Front crest behavior are
  unchanged.
- Closed the desktop Chrome performance investigation without changing
  production code. Controlled comparisons show that the corrected orientation,
  structural `destinationHeight = originalHeight - 2 * h` model, and renderer
  cleanup did not introduce the slowdown. Geometry and guarded projection are
  not the bottleneck, shading adds only a small separate cost, and Chrome
  remained GPU accelerated in the inspected runs. The evidence is most
  consistent with Chrome spending the dominant time handling thousands of
  narrow Canvas 2D `drawImage()` calls from decoded image sources during
  continuous dragging, but the browser-internal cause remains unknown. A
  canvas-backed source experiment produced no production-ready improvement and
  was fully reverted. Android remains unmeasured, and Firefox and Safari were
  not fully comparable under the same conditions. `PERFORMANCE.md` records the
  measurements, interpretation, eliminated hypotheses, and scope limits.
- Approved the corrected circular Front/Rear orientation and structural strip
  height model. Each placement exposes its Period's maximum `targetY`; the
  application computes `h = periodMaximumTargetY - targetY` and draws
  `destinationHeight = originalHeight - 2 * h` while preserving the lower fold
  anchor. Physical Front folds remain distinct renderer cue regions after Rear
  becomes non-drawable: branch changes close cue regions before zero-alpha or
  zero-raster-width returns, and Period identity separates adjacent Front folds
  when Rear has zero artwork length. Every Front fold therefore retains one
  ridge and one crest highlight through Model 2 without changing the continuous
  crest lifecycle or any cue tuning. The diagnostic region overlay is off at
  the root URL and available only through `?debug-fold-regions=1` or
  `?debug-fold-regions=corrected`. Normal rendering is visually approved.
- Known separate issue: `OperatingPhaseResolver` compares normalized gathering
  progress with an unnormalized transition threshold. With the canonical
  20%–100% range and 50% Model Transition, phase classification changes at 60%
  Visible Factor, while Rear disappearance and `foldProgress = 1` occur at 50%.
  All phases currently use the same circular surface, so this does not cause the
  crest-light placement defect. No phase-threshold correction has been made.
- Replaced the heavy black conversation bar and Index with one white,
  exhibition-like title composition on mobile and desktop. The fixed-height
  clipped title line moves vertically between the public “Konschtpräis 2026”,
  exploration “Simone Decker”, and selected project title states; reduced
  motion replaces text immediately. The existing genuine-drag threshold keeps
  project titles stable through insignificant movement. Index rows retain
  manifest order and the existing READ pipeline while presenting title and
  optional year in separate columns.
- Made semantic project landing responsive to the primary input modality.
  Desktop keeps the existing semantic-span center plus optical offset. On a
  coarse primary pointer, Index and NEXT/PREVIOUS instead share the projected
  `artworkStart` target, placing the project's leading gutter at the viewport's
  left edge. Existing viewport bounds clamp the first and last projects;
  gestures, manual camera movement, rendering, and loading priority are
  unchanged.
- Extended the viewport-first scheduler with movement-aware queued priority.
  The guarded visible range remains highest; signed Pan promotes one viewport
  ahead, inertia promotes the bounded corridor to the analytical exponential-
  damping destination, and Index plus semantic navigation promote their target
  viewport before movement begins. Idle work proceeds outward from the current
  viewport. Active requests and decodes are never cancelled; direction changes
  only reorder queued or loaded-waiting-to-decode segments. Camera, interaction,
  rendering, startup concurrency, and the empty-span fallback are unchanged.
- Replaced the production all-images startup barrier with viewport-first
  segmented loading. `public/artwork.json` now establishes ordered dimensions
  and stable global coordinates before decoding. A deterministic scheduler
  bounds network requests at three and decodes at two, gives the initial
  viewport plus the existing four-Period guard priority, renders after those
  segments settle, and loads the rest in the background. Missing or failed
  segments retain their exact global span and do not block later segments.
  The existing `loadArtwork()` path remains available for local import and
  rollback. In fresh local Firefox, three of twelve image requests block first
  draw; presentation measured 389 ms versus the previous 436 ms local trace.
- Reduced `TOUCH_CURTAIN_PINCH_DISPLACEMENT_GAIN` from `2.00` to `1.50`
  after real-device evaluation. This is a 25% strength adjustment only; the
  continuous Period interpolation, center, affected region, redistribution,
  limits, and all other interactions are unchanged.
- Removed Pinch's discrete moving-grab handoff between Periods. Each virtual
  grab now evaluates the existing redistribution model at its two adjacent
  Period anchors and linearly blends the complete results using its fractional
  position. Direct deformation and neighboring redistribution therefore travel
  continuously across Period boundaries. The 50-Period influence, clamps, Pan,
  Tap, camera, and desktop deformation path are unchanged.
- Calibrated direct two-finger manipulation after real-device testing. Pinch
  displacement gain is reduced from `4.00` to `2.00`. When the second finger
  lands, the Period under the initial midpoint is selected and its fold centre
  and projected centre coordinate are captured. That coordinate remains fixed
  until the pinch ends; it is not remapped through the deformation produced by
  each preceding frame. The Period-width map used to locate both moving grabs
  is captured at the same time, preventing each frame's deformation from
  changing the next frame's grab selection or redistribution target.
  Subsequent pointer movement contributes separation only. Pan, Tap, camera
  behavior, and curtain redistribution are unchanged.
- Replaced the fixed Pinch grab span with moving virtual grab origins. The live
  selected fold remains the opening center; `currentDistance - initialDistance`
  moves both origins outward and supplies their equal-and-opposite displacement
  through the unchanged redistribution model. The affected region therefore
  expands with the gesture, and equal separation changes produce equal openings
  whether the fingers begin nearly closed or already apart. Pan, Tap, and
  camera behavior are unchanged.
- Removed the unreferenced legacy full-destination `CanvasColumnRenderer` and
  the unconnected experimental `ColumnVisibility` contract. The active
  `ViewportCanvasColumnRenderer`, viewport selection, historical Model C
  comparison, and runtime behavior are unchanged.
- Separated the global curtain model from fine-resolution artwork sampling.
  Every Period and cumulative projected Period position still resolves on every
  frame. The camera now discovers intersecting Periods from that global table,
  adds four guard Periods on each side, and projects only their globally indexed
  artwork columns. Distant semantic-navigation targets are projected exactly
  on demand from the same Period table. In the controlled 60,000-column desktop
  trace, projected columns fell to 12,955 (78.4% fewer), column projection to
  approximately 3 ms, and median frame time from 34 ms to 26 ms. Rendering,
  shading, camera behavior, and interaction timing are unchanged.
- Profiled the active segmented renderer under a controlled production drag and
  removed behavior-neutral frame churn. Immutable source-column descriptors and
  logical source coordinates are now reused instead of rebuilt for every one of
  the artwork's columns on every frame. The Canvas renderer no longer performs
  a full save/restore around every pixel-column draw and no longer reassigns an
  unchanged backing-store size. The same Firefox trace improved from 52 ms to
  34 ms median frame time and from 64 ms to 44 ms p95 without changing input,
  geometry, shading, or animation timing. The subsequent demand-driven
  projection work addressed the remaining full-artwork geometry pass.
- Exaggerated direct two-finger curtain manipulation for calibration. The
  scalar change in finger separation now passes through
  `TOUCH_CURTAIN_PINCH_DISPLACEMENT_GAIN = 4.00` before being divided equally
  into mirrored left/right grab displacement. The virtual grabs remain exactly
  centered on the touch midpoint; no centering compensation was introduced.
- Replaced the field-like Pinch reveal with direct two-finger fabric
  manipulation. The pinch midpoint locates two moving virtual horizontal grabs
  whose span follows the change in finger separation rather than the initial
  spacing. The same scalar change moves each grab outward or inward, so
  horizontal, vertical, and diagonal pinches with equal separation changes
  produce identical deformation. Both grabs use the
  established drag redistribution over the same captured Period factors.
  Increasing separation opens between them and gathers outside; returning to
  the original separation restores the captured state exactly. No reveal
  field, zoom, or Viewport movement remains.
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
  iterations added camera inertia, retained deformation, and direct
  two-finger curtain manipulation without changing this attachment.
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
- Consolidated the development tools into one fixed, scrollable bottom-right
  panel on the normal page. Its single-column order is the five canonical
  surface controls, Viewport information, and permanently visible Performance
  information. Reset Curtain State remains the original frequently used slider
  and no separate Reset control is present. Closing leaves only a small Dev
  reopen control; neither element participates in normal page layout.
  Temporary NEXT/PREVIOUS markup remains hidden for compatibility and is no
  longer part of the panel.
- Established the current tuning as SIMONE's canonical startup and full-Reset
  defaults: 20% minimum visibility, 100% maximum visibility, 50% Reset Curtain
  State, 120 mm carrier distance, and 50% model transition. The development
  controls expose those same initial values.
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
  captured number of neighboring Periods. Touch and general local interactions
  use the 50-Period default; production desktop mouse/pen drag captures the
  approved 40-Period reach while preserving the same normalized decay model.
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
the direct-manipulation object: dragging changes curtain state directly, and
release continues that same local deformation through monotonic inertia while
the established automatic camera reframe remains independent. With one
direct-touch pointer, the artwork is
the primary object: movement pans the bounded Viewport continuously while a
subtle velocity-driven curtain response follows temporarily. Projects remain
secondary to free discovery in both cases.

The touch camera is attached to every finger delta without a threshold,
predefined step, or post-gesture reframe. The secondary curtain contribution
is computed over a captured persistent base state, follows through a bounded
first-order delay, and settles without bounce or oscillation. Camera inertia
continues the same velocity-derived response after a fast release. Two-finger
Pinch uses two moving curtain grabs anchored to the fold centre selected at
second-finger touchdown and never zooms the artwork or moves the camera.

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
control have been removed. A persistent white title area now sits independently
above the curtain. It begins with “Konschtpräis 2026”, changes to “Simone
Decker” once exploration crosses the existing genuine-drag threshold, and
shows the semantic project title after a click or READ selection. Ending an
exploration returns to the public title; insignificant movement does not evict
a presented project title.

The title area's white Index renders project titles and optional years in
manifest order, highlights the current project, and sends a selection through
the existing Reset-and-READ pipeline. It closes with its × trigger, Escape, or
selection and restores trigger focus after an explicit close.

The development panel floats outside normal layout and can collapse to its
small fixed Dev control. The curtain fills the remaining viewport beneath the
bar without its former border or demo framing. Beginning any curtain
interaction explicitly returns the application from READ to EXPLORE; this
clears the stale mode state that previously caused later semantic Moses clicks
to be rejected.

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

The desktop Chrome investigation is complete and closed without a production
change. Instrumented comparisons cleared the recent corrected orientation,
structural `2 * h` height model, and renderer cleanup as the source of the
slowdown. They also show that geometry/projection is not the bottleneck,
shading is only a small additional cost, and Chrome remains GPU accelerated.

The dominant measured stage is the thousands of narrow Canvas 2D `drawImage()`
operations using decoded segmented image sources during continuous dragging.
Chrome's handling of that workload is the best current interpretation, not a
demonstrated browser-internal root cause. A canvas-backed source variant did
not provide a production-ready improvement and was fully reverted. No
optimization from this investigation ships in production.

Android performance remains unknown and cannot be inferred from desktop
Chrome. Firefox and Safari were not fully evaluated under identical conditions,
so no controlled cross-browser conclusion should be drawn. Earlier destination
backing-store and source-type experiments remain useful historical evidence for
the viewport-canvas architecture.

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
