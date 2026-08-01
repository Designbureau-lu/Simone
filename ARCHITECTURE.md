# SIMONE Architecture

## Purpose

This document describes SIMONE's software architecture: module boundaries,
runtime data flow, and internal contracts. For project context, design goals,
and the current visual model, see `README.md` and `SIMONE.md`.

---

## High-Level Pipeline

```text
Configuration + runtime input
             |
             v
Resolved frame parameters
             |
             v
OperatingPhaseResolver
             |
             v
Global PeriodicSurface layout
             |
             v
CircularFoldSurface
             |
             v
Viewport Period discovery
             |
             v
Guarded placement objects
             |
             v
SurfaceShading
             |
             v
ViewportCanvasColumnRenderer
             |
             v
Canvas
```

- **Configuration and runtime input** originate in the browser controls.
  `SurfaceParameters` owns stable configuration; `CurtainField` owns one
  mutable `Period` per geometric period, and each Period owns Visible Factor.
- **Resolved frame parameters** are produced for each Period by
  `SurfaceParameters.resolve(visibleFactor)`. They contain validated geometry
  inputs and the authoritative `foldProgress` shared by geometry and shading.
- **`OperatingPhaseResolver`** classifies the frame as pre-transition,
  transition, or post-transition. It selects an operating phase, not a curve
  family.
- **`PeriodicSurface`** defines the geometry contract: global Period layout,
  frame bounds, guarded camera-region discovery, and exact placement of a
  requested immutable artwork column.
- **`CircularFoldSurface`** implements that contract with periodic circular
  Front and Rear folds.
- **Placement objects** are immutable geometry results for globally indexed
  columns in the guarded camera region. The application derives raster width
  from adjacent placements without changing their meaning.
- **`SurfaceShading`** supplies local branch brightness from each Period's
  resolved parameters and global appearance tuning. It does not alter geometry
  or artwork.
- **`ViewportCanvasColumnRenderer`** draws source columns and applies
  lightweight, batched appearance cues.
- **Canvas** is the final browser presentation surface.

---

## Modules

### `application/`

**Responsibilities**

- Compose the runtime pipeline.
- Coordinate artwork loading, parameter resolution, phase selection, geometry,
  shading, and rendering.
- Bind browser controls and file input at the composition boundary.

**Public contract**

- `startSimone()` creates and connects the application.
- `SimoneApplication.importArtwork()`, `updateSurface()`, and `render()` drive
  application behavior.

**Must not know**

- Circular-arc equations.
- Canvas pixel-processing details.
- Artwork interpretation or pixel generation.

### `artwork/`

**Responsibilities**

- Parse ordered source dimensions from `public/artwork.json` before decoding.
- Establish the complete virtual-artwork coordinate system from metadata.
- Load and decode viewport-critical segments through a bounded priority queue,
  then continue remaining segments in the background.
- Reprioritize queued segments from the current guarded viewport, signed Pan
  direction, predicted inertia corridor, and semantic destination. Active
  requests and decodes are never cancelled or restarted.
- Present decoded sources through that stable coordinate system without
  assembling a giant intermediate canvas.
- Expose exact one-pixel-wide vertical source columns.

**Public contract**

- `ImmutableArtwork.fromMetadata()` establishes global coordinates before
  source pixels are available.
- `ArtworkSegmentScheduler` owns bounded request/decode state and priority.
- `loadArtwork(files)` remains the all-at-once local-import rollback path.
- `ImmutableArtwork.columnAt(sourceX)` returns an immutable source-column
  reference when its segment is decoded, otherwise `null`.

**Must not know**

- Surface geometry.
- visibility phases;
- shading or canvas presentation.

### `navigation/`

**Responsibilities**

- Define logical artwork structure independently of source-image dimensions.
- Parse UTF-8 project-span metadata.
- Convert cumulative logical unit ranges into artwork coordinates.
- Disable semantic navigation when project spans exceed loaded capacity.

**Current layout**

- Gutter width: 40 px.
- Column width: 400 px.
- Repetitions per loaded image: 10.
- Unit width: gutter width + column width.

**Interaction-mode boundary**

Project metadata and semantic navigation belong to READ mode only. EXPLORE
must not depend on project ranges, project identity, or navigation state.
NEXT/PREVIOUS are temporary READ evaluation controls rather than general
curtain interactions.

### `geometry/`

**Responsibilities**

- Define the periodic-surface contract.
- Resolve the active operating phase.
- Compute frame bounds, branch allocation, circular arcs, analytical slopes,
  and destination placements.

**Public contract**

- `PeriodicSurface.frameFor(artwork, curtainField)` resolves the global Period
  layout and returns frame dimensions.
- `PeriodicSurface.samplingRangeForProjectedWindow(...)` locates a guarded
  global artwork range from the complete Period table.
- `PeriodicSurface.mapColumn(column, curtainField)` returns an exact placement.
- `OperatingPhaseResolver.resolve(parameters)` returns an `OperatingPhase`.
- `CircularFoldSurface` is the active `PeriodicSurface` implementation.

**Must not know**

- Canvas APIs.
- gradient, color, or brightness tuning;
- UI controls or file decoding.

### `rendering/`

**Responsibilities**

- Rasterize exact source columns at resolved destinations.
- Draw destination widths that the application derives without crossing branch
  boundaries.
- Collect visible fold regions.
- Apply configured Rear darkening, crest highlights, and valley shadows with
  batched Canvas 2D operations.

**Public contract**

- `beginFrame(frame, appearance)` initializes the canvas and frame appearance.
- `drawColumn(column, placement, appearance)` draws one mapped source column.
- `endFrame()` applies frame-level fold cues and completes the frame.

**Must not know**

- How circular arcs are solved.
- How Visible Factor becomes projected carrier spacing.
- How `foldProgress` is calculated.

### `shading/`

**Responsibilities**

- Own all appearance constants and gradient tuning.
- Resolve branch-dependent brightness from placement and `foldProgress`.
- Resolve crest lifecycle from each Period's local surface parameters.
- Provide immutable frame-level appearance settings to the renderer.

**Public contract**

- `SurfaceShading.factorFor(placement, parameters)` returns column brightness.
- `SurfaceShading.appearanceFor()` returns frame appearance data.
- `SurfaceShading.crestLifecycleFor(parameters)` returns local crest emphasis.

**Must not know**

- Source pixel content.
- Canvas drawing order or rasterization mechanics.
- Circular-arc placement equations.

### `surface/`

**Responsibilities**

- Validate user-facing surface configuration.
- Constrain Visible Factor to its permitted range.
- Convert user-facing values into resolved frame parameters.
- Compute the single authoritative `foldProgress`.
- Own per-Period runtime Visible Factor through `CurtainField` and `Period`.

**Public contract**

- `SurfaceParameters.configure(values)` updates accepted inputs.
- `SurfaceParameters.resolve(visibleFactor)` returns an immutable parameter
  snapshot for one Period value.
- `CurtainField.setResetCurtainState(value)` records and applies the reference
  curtain state.
- `CurtainField.setResetCurtainStateTarget(value)` records that reference
  without immediately replacing runtime Period values.
- `CurtainField.setVisibleFactors(values)` applies one validated intermediate
  Visible Factor per Period during coordinated state transitions.
- `CurtainField.resolve(parameters)` resolves its Period collection for a frame.

**Must not know**

- Artwork dimensions or pixels.
- Circular-arc implementation details.
- Canvas rendering and appearance gradients.

## Placement Contract

`CircularFoldSurface.mapColumn()` produces one immutable placement for each
requested globally indexed artwork column.

| Field | Producer | Consumer | Meaning |
| --- | --- | --- | --- |
| `sourceX` | Geometry | Diagnostics and geometry-aware consumers | Original horizontal source-column coordinate. |
| `periodIndex` | Geometry | Application | Identity used to retrieve the Period's local resolved shading parameters. |
| `targetX` | Geometry | Application and renderer | Horizontal destination coordinate in the output frame. |
| `targetY` | Geometry | Renderer | Vertical destination coordinate in the output frame. |
| `localSlope` | Geometry | Renderer; available to shading | Analytical slope at the mapped point. The renderer uses slope continuity to locate fold regions and crests. |
| `branch` | Geometry | Application, shading, renderer | Viewer-relative branch identity: `front` or `rear`. |
| `alpha` | Geometry visibility policy | Application and renderer | Branch visibility. It is forwarded unchanged and used only when drawing. |
| `allocatedWidth` | Geometry | Reserved geometry-aware consumers and diagnostics | Projected chord width allocated to the selected branch. |

### Front and Rear semantics

- `front` identifies the fold facing the viewer. It uses the visually forward
  circular-arc orientation.
- `rear` identifies the opposing fold behind it. It uses the opposite
  orientation and may receive Rear-specific appearance.

Branch identity is semantic, not an arbitrary alternating label. The
application does not calculate it, and the renderer does not reinterpret it.

---

## Separation of Responsibilities

### Configuration

Configuration describes installation limits and model tuning, including
visibility limits, carrier distance, and Model Transition. It is validated at
the surface boundary.

### Runtime state (future)

`CurtainField` now owns local Visible Factor state. Temporal values such as
velocity, drag state, breathing phase, and horizontal browsing position remain
future concerns and should stay distinct from stable configuration and derived
frame parameters.

### Geometry

Geometry converts resolved parameters and immutable source-column coordinates
into placements. It owns branch identity, arc placement, and analytical slope.
It does not draw.

### Shading

Shading owns global visual tuning and derives local modulation from each
Period's resolved state and geometry metadata. It does not move columns or
inspect artwork pixels.

### Renderer

The renderer draws exact source pixels at supplied destinations. It may group
placements for batched visual cues, but it does not solve or modify geometry.

### Application

The application controls order and data movement. It is the only layer that
coordinates all pipeline stages, but it owns none of their domain equations.

The central boundary is:

```text
Geometry computes placements.
Renderer draws placements.
```

---

## Current Design Principles

- **Immutable artwork:** source pixels are referenced, never reconstructed.
- **Deterministic geometry:** equal inputs produce equal placements.
- **Lightweight rendering:** appearance uses bounded, batched Canvas operations
  rather than filters or per-pixel processing.
- **Visual plausibility over strict simulation:** the result must communicate
  folded form and preserve artwork readability.
- **Performance first:** interaction must remain responsive for very wide
  artwork.
- **Explicit ownership:** parameters, geometry, shading, and rendering own
  different decisions.
- **Stable contracts:** new surface or appearance models should fit existing
  module boundaries where possible.

---

## Intentional Approximations

### Complementary visible arc

Once the solved physical circular arc exceeds a semicircle,
`CircularFoldSurface` uses the complementary minor arc for visible placement.
This prevents horizontal self-overlap and preserves a coherent silhouette.

### Simplified branch allocation

Front/Rear allocation follows a direct linear progression from 50:50 to 100:0.
This is a clear visual model rather than a derived material-contact simulation.

### Continuous artwork mapping

Artwork columns remain continuously mapped across the visible arc. SIMONE does
not currently remove columns through physical carrier occlusion. Readability and
continuity take precedence over exact visible material length.

Decoded source-column descriptors are immutable and cached for the lifetime of
an imported artwork. Their logical virtual coordinates are likewise cached for
the active artwork layout. Production frames reuse both inputs while computing
the same requested curtain samples; caching changes allocation lifecycle, not
artwork sampling or geometry.

The physical curtain and its printed artwork now have explicit resolution
boundaries. Every frame resolves the complete ordered Period table and its
global cumulative projected positions. The camera is located against those
global Period intervals. Exact artwork-column projection is demand-driven:
only columns belonging to intersecting Periods plus four guard Periods on each
side are sampled through `mapColumn()`. Each sample retains its original global
logical coordinate and Period index. Semantic navigation may sample a distant
column directly from the same global table before the camera arrives. No
viewport-local curtain, approximate fold, or alternate coordinate system is
introduced.

### Lightweight shading

Rear darkening and crest/valley gradients provide stable depth cues. They are
not derived from lights, surface normals, perspective, or material response.

These approximations exist to protect artwork integrity, visual continuity, and
interactive performance.

---

## Interaction Modes

### EXPLORE

EXPLORE treats the curtain itself as a continuous field of discovery. Dragging
with a mouse or pen is primary curtain manipulation. Direct touch uses a
different input language over the same Viewport, CurtainField, geometry, and
renderer: one finger owns continuous bounded camera movement, while a small
velocity-derived local Visible Factor contribution lets the curtain accompany
exploration. The contribution is evaluated from a captured base state, retains
part of its local reveal and directional redistribution, and develops
continuously through camera inertia and settlement. Two fingers own a separate
direct curtain manipulation. Each finger captures its own local CurtainField
interaction from one captured base state. On each update, the live midpoint
is no longer sampled: the Period under the midpoint at second-finger touchdown
is selected, and its fold-centre projected coordinate is captured once to
anchor two virtual horizontal grabs for the entire gesture. It is not remapped
through the changing geometry on later frames. The Period-width coordinate map
used to locate the moving grabs is captured with it, so deformation cannot feed
back into grab selection. Their outward positions grow with the absolute change in
Euclidean finger separation. The same signed separation change drives their
equal-and-opposite displacement, regardless of finger angle or initial touch
spacing. Each moving grab evaluates the established redistribution model at
its two adjacent Period anchors and blends those complete results by its
fractional position, avoiding a discrete deformation handoff at Period
boundaries. Their contributions are added over the captured state.
Increasing separation therefore expands the affected fabric as it opens;
restoring the original separation restores the captured state. Pinch never
zooms artwork or moves the Viewport. The current exploration build multiplies
separation movement by `TOUCH_CURTAIN_PINCH_DISPLACEMENT_GAIN = 1.50`.
Returning to one finger immediately starts a fresh pan.

Projects are secondary in EXPLORE. The local click/Moses opening is assistance
around a physical click position, not project navigation or semantic project
isolation. It reuses the existing symmetric local-deformation snapshot,
animates outward, and returns to that snapshot. A small pointer movement
tolerance distinguishes it from a click, and the application attention-mode
flag prevents Moses from running in READ.

### READ

READ starts with explicit project selection, expected primarily through a
future Index. Project selection combines navigation and reveal. Geometry should
flatten the selected project for reading while folds keep surrounding curtain
material unreadable. READ must not simulate attention through blur, opacity,
darkening, or other graphical focus effects.

Entering READ creates a fresh composition rather than preserving or restoring
the previous EXPLORE deformation. The transition must return the whole curtain
meaningfully to its neutral folded state before composing the selected
project. Reset is an expressive mode transition that communicates leaving
EXPLORE, not merely a technical state setter.

The pipeline is intentionally sequential:

```text
Select Project
    -> Reset (curtain settles)
    -> Move to project
    -> Present Project
    -> Reading
```

The flat region is the project's exact semantic interval: from its left gutter
to its right edge. It is not an “open N columns” heuristic, and the result is a
project presentation rather than a generic opening gesture. Gentle transition
folds on each side will eventually connect that flat interval to the normally
dense curtain.

NEXT/PREVIOUS are provisionally part of READ and currently serve as evaluation
controls. Their navigation code is useful, but their automatic partial opening
is not the final READ interaction. A later READ design will likely refold the
previous project before revealing a new selection.

A temporary project dropdown is a second entry point into this same prototype
pipeline. It supplies a selected project index after animated Reset; the shared
indexed navigator continues to own semantic lookup and Viewport movement. The
selected semantic span is presented uniformly at full visibility, and its
semantic midpoint is geometrically aligned with the Viewport midpoint. A
single presentation-only offset then supplies consistent optical centering
without changing that semantic calculation. Gentle transition folds and the
final reading composition remain future refinements in that shared pipeline
rather than individual controls.

The sequence intentionally closes the exploratory composition before
presenting a work. Architecturally and experientially, it behaves more like
turning a page than following conventional website navigation.

## Future Architecture

The following are possible architectural directions, not implementation plans:

- A dedicated `SurfaceState` for mutable temporal values.
- An interaction layer that translates pointer input into surface state without
  coupling UI events to geometry.
- Direct manipulation of the folded surface.
- Velocity, inertia, and damping as state evolution independent of rendering.
- Idle breathing represented as a bounded temporal state contribution.
- Horizontal browsing position independent of Visible Factor.
- Optional alternate visibility or physically predictive models behind stable
  geometry and rendering contracts.

Any evolution should preserve deterministic frame resolution and keep runtime
state separate from immutable artwork and installation configuration.

### Typography source quality

During development, typography proved much more sensitive than photographic
imagery to even slight raster softening. If that sensitivity eventually limits
typography quality, investigate preparing type as a separate high-resolution
PNG layer, SVG rendered to an off-screen surface, or another appropriate vector
or renderable source.

The curtain renderer must remain unchanged and source-agnostic. Typography must
enter the same immutable column-based projection pipeline and receive exactly
the same geometry as photographic or illustrated artwork. Whether a sampled
column originated in a photograph, illustration, typography, PNG, SVG, or
another renderable source must not alter deformation behavior or become a
renderer concern. Passing every source through the same projection preserves
both identical deformation and the physical illusion of the curtain.

This is an architectural reminder only, not a feature request. It requires no
implementation or experiments and should be revisited only after the overall
visual design and rendering pipeline have stabilized and typography quality is
a demonstrated problem.

---

## Terminology

- **`CircularFoldSurface`**: active periodic circular-fold geometry.
- **`OperatingPhaseResolver`**: classifies pre-transition, transition, and
  post-transition operation.
- **`PeriodicSurface`**: geometry contract implemented by surface models.
- **Visible Factor**: per-Period measure of artwork visibility.
- **Reset Curtain State**: reference Visible Factor assigned when the curtain
  is initially created or restored.
- **Front branch**: viewer-facing fold.
- **Rear branch**: opposing fold behind the Front branch.
- **Model Transition**: point at which Rear allocation and visibility reach
  zero.
- **Placement**: immutable geometry result for one source artwork column.
