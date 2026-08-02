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

`ImmutableArtwork` owns one continuous virtual coordinate system across ordered
source segments and exposes immutable one-pixel-wide vertical columns as those
segments become available. `public/artwork.json` supplies the ordered filename,
pixel dimensions, and optional compressed byte size before image decoding, so
global artwork, curtain, camera, and semantic coordinates are final from the
first frame. Startup requests only segments intersecting the initial viewport
and its existing guard region; a bounded scheduler loads the remainder in the
background. During exploration, queued work follows the signed Pan direction
and the corridor predicted from the existing inertia velocity, gain, damping,
and camera bounds. Semantic destinations pre-empt background work through the
same scheduler. Active requests continue normally. `loadArtwork` remains the
all-at-once local-import rollback path.
The referenced files live in `public/images/`.

Semantic project ranges are defined in `public/projects.txt`. They are measured
in logical Gutter|Column units, not inferred from image dimensions. The current
central layout configuration uses a 40 px gutter, a 400 px artwork column, and
10 repetitions per manifest segment.

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
initially created or restored. Runtime Reset control changes interpolate each
Period toward that reference before applying the exact reference value on the
final frame; direct dragging redistributes local Period values.

### Geometry

`PeriodicSurface` documents the geometry contract.
`CircularFoldSurface` is the active concrete implementation. It resolves the
complete ordered Period model: Front/Rear allocation, circular arcs, analytical
surface definitions, projected widths, and cumulative global positions. Exact
destination placement is evaluated when an artwork column is sampled.

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

`ViewportCanvasColumnRenderer` draws exact source columns at geometry-provided
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
    -> global CircularFoldSurface Period layout
    -> camera Period discovery
    -> guarded artwork-column placements
    -> SurfaceShading appearance
    -> ViewportCanvasColumnRenderer
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
7. `CircularFoldSurface.frameFor()` resolves every Period and its cumulative
   position in the global curtain.
8. The global camera window identifies intersecting Periods and includes a
   conservative guard on both sides.
9. Immutable artwork columns belonging to that guarded region are assigned to
   the Front or Rear branch and mapped onto their circular arcs using their
   original global artwork coordinates.
10. Camera-visible placements are passed through shading to the renderer.

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

Geometry produces one immutable placement for each requested artwork column:

- `sourceX`: source-column coordinate.
- `targetX`, `targetY`: destination coordinates.
- `depthFromFront`: current physical distance behind the front crest.
- `referenceMaximumDepth`: stable physical maximum supplied by the fold model.
- `localSlope`: analytical slope of the circular surface.
- `branch`: `front` or `rear` identity.
- `alpha`: branch visibility supplied to the renderer.
- `allocatedWidth`: projected chord width associated with the branch.

The application derives destination column width from adjacent `targetX`
values, without crossing branch boundaries. Requesting only a guarded region
does not change the placement calculation: Period state, artwork coordinates,
and camera coordinates remain global.

Column destination height is independently scaled by the ratio of current
physical depth to the fold model's stable maximum depth. The signal collapses
to zero as the curtain flattens, restoring uniform full-height columns. The
former lower edge (`targetY + source height`) remains authoritative, so the top
silhouette emerges from column height rather than being authored as another
wave.

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

### Interaction modes

SIMONE distinguishes two modes of attention:

- **EXPLORE:** continuous discovery through direct curtain dragging. Drag
  remains the primary gesture and projects are secondary to free exploration.
  The local click/Moses helper belongs only to EXPLORE: it temporarily opens
  around a clicked physical position, remains secondary to drag, and performs
  no semantic navigation. It reuses the curtain's local deformation and
  returns exactly to the state captured at the click.
- **READ:** explicit project selection through a future Index combines
  navigation and presentation. The chosen project becomes flat and readable;
  surrounding material remains unreadable because it stays folded. Graphical
  focus effects such as blur, fading, or darkening are not part of this model.
  Entering READ starts a fresh composition and does not preserve or restore the
  previous EXPLORE deformation. Reset intentionally communicates the departure
  from EXPLORE; it is no longer merely a technical function. The selected
  project then flattens across its exact semantic boundaries—from left gutter
  to right edge—and is presented for reading.

The READ sequence is:

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

This composition is closer to turning a page in a book than navigating a
website. Closing one work before presenting the next is intentionally part of
the experience. Geometric centering is followed by one consistent,
presentation-only optical offset. Gentle transition folds remain a future
refinement of the final reading composition.

The existing NEXT/PREVIOUS and automatic partial reveal are provisional READ
experiments, not final interaction design.

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
- if typography raster softness becomes a demonstrated limitation, a separate
  high-resolution PNG, off-screen SVG/vector, or other renderable typography
  source that still passes through the existing immutable column-projection
  pipeline and receives exactly the same curtain deformation as all artwork.

Any future work should preserve immutable artwork, modular geometry, and an
interactive rendering budget. The typography-source idea is not planned work
and must not make the renderer aware of source type; revisit it only after the
visual design and rendering pipeline have stabilized.

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
