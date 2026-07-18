# Model C — Viewport Canvas Proof of Concept

Status: temporary branch prototype; not a production decision.

## Architectural change

Artwork and geometry remain in their existing immutable source and virtual
curtain coordinate spaces. `ViewingSurface` resolves the browser-visible
canvas backing store from its CSS bounds and device-pixel ratio. After geometry
and Viewport selection, `ModelCApplication` converts only selected placements
into viewing-space coordinates. `ModelCCanvasColumnRenderer` receives only
those viewing-space placements.

The production `CanvasColumnRenderer` is unchanged. Model C is composed from
`startSimone.js` only on this branch and can be discarded with the branch.

## Production assumptions exposed

- `CircularFoldSurface.frameFor()` uses artwork width as destination width.
- `Viewport.presentationExtent` was set to that artwork-width frame, coupling
  virtual-to-presentation scale to destination allocation.
- Pointer displacement implicitly used `canvas.width / CSS width`; changing the
  backing store therefore changed interaction sensitivity unless the legacy
  artwork-width conversion was retained separately.
- The production renderer uses `column.height` for both source crop height and
  destination height. A viewing-space renderer needs independent source and
  destination heights, so the prototype renderer adds `placement.height`.
- Crest minimum and maximum widths are destination-pixel constants. Model C
  scales them into viewing space to retain their displayed size.

## Interaction

CurtainField, geometry, Viewport selection, local interaction, and Viewport
position remain unchanged. Pointer positions use the viewing canvas for inverse
Viewport mapping. Drag displacement is converted from the canvas content box
into the visible projected extent, so pointer motion and virtual fold motion
share one coordinate scale. No wall constraint or new horizontal limit is
introduced.

## Instrumentation

The Model C performance panel keeps a rolling 120-frame sample and reports
current, median, and p95 values for:

- total frame;
- geometry;
- Viewport selection;
- canvas reset;
- source-column rendering;
- shading and overlays.

It also reports destination dimensions and pixel count, draw calls, selected
and total columns, period count, DPR, and an estimated missed-frame count. A
missed frame is estimated from total synchronous frame time against a 60 Hz
budget; it is not a compositor trace.

## Visual equivalence risks

- An experiment that rounded horizontal edges in artwork-width virtual space
  before scaling was reverted: it prevented narrow viewing-space columns from
  collapsing, increased draw calls from approximately 3,366 to 7,488, and
  raised rendering time from approximately 55 ms to 240 ms. Model C again
  rounds in viewing space to preserve the original prototype performance.
- CSS downscaling of the production canvas and direct DPR rendering can select
  different raster samples or antialiasing paths.
- Model C now derives its backing store from `clientWidth` and `clientHeight`,
  excluding the existing border from the drawable viewport. Visual validation
  must confirm that this matches production's effective content-box height.
- Fractional DPR and browser resizing can change backing dimensions by one
  pixel through rounding.
- Fold and Rear regions use the same selected columns and appearance logic, but
  their raster boundaries inherit the transformed-coordinate rounding above.

## Measurements

Real production comparison is pending execution with the same artwork, browser,
controls, Viewport position, and interaction sequence on `main` and this branch.
The repository contains no representative artwork file, so no defensible
performance difference is recorded here yet.

For an in-branch allocation comparison using one unchanged live state, run:

```js
await window.runModelCComparison()
```

This performs 10 warm-up frames per mode and 30 measured frames per mode in
alternating five-frame blocks. `dynamic` uses captured production destination
dimensions; `viewport` uses CSS size × DPR. Geometry, selection, source columns,
and state are shared. The command restores viewport mode when complete.

## Preliminary viability

The prototype demonstrates that the geometry/rendering boundary can support a
viewport-sized destination without adding a wall constraint. Final viability
depends on visual comparison and controlled measurements, especially at very
wide artwork dimensions and during local dragging.
