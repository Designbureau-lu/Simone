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
PeriodicSurface contract
             |
             v
CircularFoldSurface
             |
             v
Placement objects
             |
             v
SurfaceShading
             |
             v
CanvasColumnRenderer
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
- **`PeriodicSurface`** defines the geometry contract: frame bounds and one
  placement per immutable artwork column.
- **`CircularFoldSurface`** implements that contract with periodic circular
  Front and Rear folds.
- **Placement objects** are immutable geometry results. The application derives
  raster width from adjacent placements without changing their meaning.
- **`SurfaceShading`** supplies local branch brightness from each Period's
  resolved parameters and global appearance tuning. It does not alter geometry
  or artwork.
- **`CanvasColumnRenderer`** draws source columns and applies lightweight,
  batched appearance cues.
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

- Decode ordered production-segment image files.
- Assemble and own one continuous immutable source image.
- Expose exact one-pixel-wide vertical source columns.

**Public contract**

- `loadArtwork(files)` resolves one `ImmutableArtwork`.
- `ImmutableArtwork.columnAt(sourceX)` returns an immutable source-column
  reference.

**Must not know**

- Surface geometry.
- visibility phases;
- shading or canvas presentation.

### `geometry/`

**Responsibilities**

- Define the periodic-surface contract.
- Resolve the active operating phase.
- Compute frame bounds, branch allocation, circular arcs, analytical slopes,
  and destination placements.

**Public contract**

- `PeriodicSurface.frameFor(artwork, parameters)` returns frame dimensions.
- `PeriodicSurface.mapColumn(column, parameters)` returns a placement.
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
- Provide immutable frame-level appearance settings to the renderer.

**Public contract**

- `SurfaceShading.factorFor(placement, parameters)` returns column brightness.
- `SurfaceShading.appearanceFor(parameters)` returns frame appearance data.

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
- `CurtainField.setVisibleFactorForAll(value)` performs the current uniform
  interaction update.
- `CurtainField.resolve(parameters)` resolves its Period collection for a frame.

**Must not know**

- Artwork dimensions or pixels.
- Circular-arc implementation details.
- Canvas rendering and appearance gradients.

### `visibility/`

This folder contains an experimental visibility contract that is not currently
connected by the composition root.

**Responsibilities**

- Represent a possible independent column-visibility policy.

**Public contract**

- `ColumnVisibility.isVisible(column, placement)` evaluates visibility.
- `ColumnVisibility.appearanceFor(column, placement)` returns visibility
  appearance metadata.

**Must not know**

- How artwork pixels are generated or edited.
- How surface placements are calculated.
- How a renderer realizes visibility.

---

## Placement Contract

`CircularFoldSurface.mapColumn()` produces one immutable placement for each
immutable artwork column.

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

### Lightweight shading

Rear darkening and crest/valley gradients provide stable depth cues. They are
not derived from lights, surface normals, perspective, or material response.

These approximations exist to protect artwork integrity, visual continuity, and
interactive performance.

---

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

---

## Terminology

- **`CircularFoldSurface`**: active periodic circular-fold geometry.
- **`OperatingPhaseResolver`**: classifies pre-transition, transition, and
  post-transition operation.
- **`PeriodicSurface`**: geometry contract implemented by surface models.
- **Visible Factor**: canonical user-facing measure of artwork visibility.
- **Front branch**: viewer-facing fold.
- **Rear branch**: opposing fold behind the Front branch.
- **Model Transition**: point at which Rear allocation and visibility reach
  zero.
- **Placement**: immutable geometry result for one source artwork column.
