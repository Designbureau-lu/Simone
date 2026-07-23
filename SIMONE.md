# SIMONE

## 1. Project Overview

SIMONE is a folded-surface engine for presenting graphical content. It maps an
immutable source image onto a periodic arrangement of circular folds and shows
how that artwork reads at different Visible Factor values.

The project originated as a simulator for a physical exhibition curtain. Its
scope has since shifted from reproducing cloth exactly to providing a coherent,
interactive representation of graphics on a folded surface. The current goal
is visual continuity, readable artwork, and convincing interaction rather than
strict physical simulation.

SIMONE is a design and visibility tool. It is not a photorealistic renderer or
a general cloth simulator.

## 2. Design Philosophy

- Visual plausibility takes precedence over perfect physical simulation.
- Performance is a primary design constraint, including during interaction.
- Geometry may intentionally approximate physical behavior when that improves
  visual continuity or artwork readability.
- Artwork is immutable. SIMONE remaps existing vertical pixel columns; it does
  not invent, redraw, or interpret source pixels.
- Geometry and appearance remain separate. Geometry determines placement;
  shading and rendering determine presentation.
- Rendering remains lightweight, deterministic, and browser-compatible.
- Visibility and design comprehension are more important than photorealism.

## 3. Architecture

### Artwork

`ImmutableArtwork` owns one continuous decoded source and exposes immutable
one-pixel-wide vertical columns. `loadArtwork` decodes ordered production
segments, assembles them horizontally, and keeps their boundaries private.
At startup, `public/images.txt` supplies one filename per line in display
order; blank lines and comments beginning with `#` are ignored. The referenced
files live in `public/images/`.

### Parameters

`SurfaceParameters` validates user-facing configuration and resolves the values
consumed for one frame. `CurtainField` owns one mutable `Period` for every
geometric period; each Period owns its local Visible Factor. Per-Period Visible
Factor is the canonical interaction coordinate:

- 0% means completely hidden.
- 100% means completely visible.
- Minimum Visible Factor and Maximum Visible Factor constrain its permitted
  range.

Resolved values include projected carrier spacing and the authoritative
`foldProgress` used by both geometry and shading. Reset Curtain State defines
the reference Visible Factor assigned to every Period when the field is
initially created or restored; direct dragging redistributes local Period
values.

### Geometry

`PeriodicSurface` documents the geometry contract.
`CircularFoldSurface` is the active concrete implementation. It resolves the
period, Front/Rear allocation, circular arcs, analytical slopes, and destination
placement for every artwork column.

`OperatingPhaseResolver` classifies the current frame as pre-transition,
transition, or post-transition. The current composition uses the same
`CircularFoldSurface` in all three phases; phase selection does not introduce a
different curve family.

### Shading

`SurfaceShading` owns appearance tuning. This includes Rear darkening, crest
highlight settings, valley-shadow settings, colors, strengths, widths, and
gradient stops. It consumes resolved `foldProgress` rather than independently
calculating transition progress.

### Rendering

`CanvasColumnRenderer` draws exact source columns at geometry-provided
destinations. It performs no curve solving. Fold appearance is added after the
artwork with a small number of batched Canvas 2D compositing operations and
gradients.

### Application

`SimoneApplication` coordinates the pipeline. It owns no geometry equations and
no pixel-generation logic. `startSimone` is the composition root and browser UI
adapter: it creates the modules, binds controls, and handles artwork import.

### Data flow

```text
UI configuration
    + CurtainField runtime input
    -> per-Period SurfaceParameters.resolve()
    -> OperatingPhaseResolver
    -> CircularFoldSurface frame and placements
    -> SurfaceShading appearance
    -> CanvasColumnRenderer
    -> canvas image
```

## 4. Geometry Pipeline

For each render:

1. User configuration is validated by `SurfaceParameters`.
2. `CurtainField` supplies the Visible Factor owned by each Period.
3. `SurfaceParameters` resolves frame parameters for those Period values.
4. Visible Factor determines projected carrier spacing.
5. `foldProgress` determines Front/Rear allocation on the pre-transition
   timeline.
6. `OperatingPhaseResolver` identifies the current operating phase.
7. `CircularFoldSurface.frameFor()` resolves the current periods and frame
   bounds.
8. Every immutable artwork column is assigned to the Front or Rear branch and
   mapped onto its circular arc.
9. The resulting placements are passed through shading to the renderer.

### Front and Rear branches

One period contains a Front branch and a Rear branch:

- Front is the fold facing the viewer and uses the visually forward arc
  orientation.
- Rear is the opposing fold behind it and uses the opposite orientation.

At Maximum Visible Factor, artwork allocation is 50% Front and 50% Rear. As
Visible Factor decreases toward Model Transition, allocation evolves
continuously toward 100% Front and 0% Rear. Rear remains opaque while it exists
and disappears at the transition.

### Operating phases

- **Pre-transition:** Front/Rear allocation evolves continuously. Fold depth and
  lightweight depth cues increase.
- **Transition:** Front allocation has reached 100%; Rear allocation and
  visibility have reached zero.
- **Post-transition:** only the Front branch remains. It continues changing
  width through the same circular-fold geometry without further branch
  redistribution.

The phase names describe operating state, not separate surface classes.

## 5. Rendering Pipeline

### Placement contract

Geometry produces one immutable placement per artwork column:

- `sourceX`: source-column coordinate.
- `targetX`, `targetY`: destination coordinates.
- `localSlope`: analytical slope of the circular surface.
- `branch`: `front` or `rear` identity.
- `alpha`: branch visibility supplied to the renderer.
- `allocatedWidth`: projected chord width associated with the branch.

The application derives destination column width from adjacent `targetX`
values, without crossing branch boundaries.

### Shading responsibilities

Shading owns appearance values and tuning constants. Rear darkening and valley
shadow modulation follow each Period's local pre-transition progress. Crest and
valley settings describe stable, lightweight visual cues. The renderer locates
the ridge from the rendered sample nearest zero slope and draws a narrow crest
on the geometry's outward/front branch only. Its local strength follows maximum
absolute rendered slope. Shading supplies a normalized linear lifecycle
envelope—zero at flat, one at the model transition, and zero at maximum
compression—which multiplies, rather than replaces, geometric strength.
Rear/down folds retain valley shading without white crest light. Rendering does
not interpret interaction state or alter geometry or source artwork.

### Crest-light model

Front-fold geometry determines crest eligibility, ridge position, and gradient
dimensions. The gradient is centred on the geometric ridge and spans 50% of
the front fold width. Local slope supplies a near-flat onset safeguard; it
reaches full strength early and does not control the complete interaction envelope.
Lifecycle timing supplies the main intensity envelope, peaking at the model
transition and suppressing the light at both the flat and maximum-compression
endpoints.

Final crest intensity is:

```text
geometry × lifecycle × maximum centre alpha
```

The current maximum centre alpha is `0.25`. The crest is a white `source-atop`
gradient that does not analyse the underlying artwork, so its perceived
visibility varies with artwork luminance.

### Renderer responsibilities

The renderer:

- draws exact source columns at resolved placements;
- preserves branch boundaries during rasterization;
- groups visible columns into fold regions;
- applies Rear darkening;
- applies one crest-highlight gradient per visible front fold and one
  valley-shadow gradient per visible fold using `source-atop`.

Geometry does not render. The renderer does not solve geometry or modify the
surface model.

## 6. Current Approximations

The following are intentional design choices:

- **Complementary visible arc:** after the constant-length physical arc passes
  the semicircle point, SIMONE displays its complementary minor arc. This keeps
  the visible silhouette smooth and horizontally monotonic.
- **Artwork continuity over exact visible material length:** artwork remains
  continuously mapped across that visible arc instead of being physically
  occluded behind a carrier.
- **Simplified branch allocation:** Front/Rear artwork allocation follows a
  direct linear transition controlled by `foldProgress`.
- **Step visibility at Model Transition:** Rear remains fully opaque before the
  transition and is absent at and after it.
- **Lightweight shading:** Rear darkening, crest highlights, and valley shadows
  are restrained presentation cues rather than a lighting simulation.
- **Orthographic presentation:** the current model has no viewer-height,
  perspective, or camera-distance calculation.
- **Unit bridge:** the current implementation treats one millimetre as one
  internal pixel for projected geometry.

These approximations define the present visual model. They are not accidental
fallbacks or unresolved defects.

## 7. Current Limitations

- SIMONE does not simulate cloth, elasticity, gravity, or material dynamics.
- There is no self-occlusion, depth buffer, or carrier-contact model.
- There is no physical lighting or surface-normal illumination model.
- Perspective and viewer position are not represented.
- Interaction supports direct local curtain dragging.
- Visible Factor and horizontal artwork browsing are not independent runtime
  coordinates yet.
- Every Period owns local Visible Factor state, and direct interaction
  redistributes changes across neighboring Periods.

These limitations describe the current product boundary and should not be read
as bugs.

## 8. Future Directions

The following are research possibilities, not planned commitments:

- direct manipulation by grabbing and dragging the folded surface;
- inertial movement and damping;
- subtle idle or breathing motion;
- an independent horizontal browsing position for the artwork;
- a dedicated mutable `SurfaceState` separated from installation configuration;
- perspective informed by viewer height and distance;
- optional visibility or occlusion models;
- an optional physically predictive mode alongside the current visual model.

Any future work should preserve immutable artwork, modular geometry, and an
interactive rendering budget.

## 9. Naming

Current terminology is deliberately descriptive:

- `CircularFoldSurface`: the active circular-arc folded-surface implementation.
- `OperatingPhaseResolver`: classifies pre-transition, transition, and
  post-transition operation.
- `Visible Factor`: per-Period measure of visible artwork.
- `Reset Curtain State`: reference Visible Factor assigned when the curtain is
  initially created or restored.
- `Minimum Visible Factor` / `Maximum Visible Factor`: permitted visibility
  limits.
- `Front` / `Rear`: viewer-relative fold branches.
- `Model Transition`: boundary at which Rear allocation and visibility reach
  zero.

Names referring to earlier multi-profile or separate post-transition geometry
belong to previous experiments and are not part of the current architecture.
