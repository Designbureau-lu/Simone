# SIMONE Performance Notes

This document records controlled performance observations. It does not define
optimization decisions.

## Canvas source-type experiment

One recorded frame was replayed with identical geometry, Viewport selection,
source columns, destinations, alpha values, draw count, overlays, and backing
dimensions. Only the `drawImage()` source object changed:

- `HTMLImageElement`
- `HTMLCanvasElement` containing identical pixels

Firefox and Safari produced essentially identical timings for both variants.
The Canvas source-object type was therefore eliminated as the dominant cause
of the observed multi-image slowdown.

## Destination backing-store width experiment

One recorded frame was replayed with identical source objects, source columns,
destinations, alpha values, draw count, and overlays. Only the destination
Canvas backing-store width changed:

- Variant A: 5000 × H
- Variant B: 10000 × H

Observed results:

- Firefox: approximately 1 ms at 5000 × H and 89 ms at 10000 × H.
- Safari: no meaningful difference between the two widths.
- Chrome: slow in both variants, with a moderate additional cost at the larger
  width.

These results establish destination backing-store width as a first-order
performance factor in Firefox. Safari is largely insensitive to this change.
Chrome's dominant cost has not yet been isolated and requires a separate
controlled experiment.

No renderer optimization follows automatically from these observations.

## Isolated geometric crest lighting

The previous rendered-depth crest and the isolated slope-driven crest were
compared in Firefox headless using the same 20000 × 1000 benchmark artwork,
scene state, viewport-sized Model C destination, 20 warm-up frames, and 120
measured frames per implementation.

| Implementation | Metric | Current | Median | p95 |
| --- | --- | ---: | ---: | ---: |
| Previous depth crest | Frame (ms) | 28 | 28 | 30 |
| Isolated slope crest | Frame (ms) | 28 | 28 | 30 |
| Previous depth crest | Rendering (ms) | 16 | 16 | 17 |
| Isolated slope crest | Rendering (ms) | 16 | 17 | 18 |
| Previous depth crest | Shading (ms) | 6 | 6 | 7 |
| Isolated slope crest | Shading (ms) | 6 | 6 | 7 |
| Previous depth crest | Draw calls | 1284 | 1284 | 1284 |
| Isolated slope crest | Draw calls | 1284 | 1284 | 1284 |

Median frame, shading, and draw-call measurements are unchanged. Rendering
median and p95 increased by 1 ms because the new renderer collects one maximum
absolute slope per drawn column. The crest adds no source-column draw calls and
leaves total frame median and p95 unchanged.

## Crest orientation filtering

Applying the isolated crest only to the geometry's outward/front branch was
compared with applying it to both branches in Firefox headless, using the same
20000 × 1000 benchmark artwork, scene state, viewport-sized Model C
destination, 20 warm-up frames, and 120 measured frames per implementation.

| Implementation | Metric | Current | Median | p95 |
| --- | --- | ---: | ---: | ---: |
| Both branches | Frame (ms) | 28 | 28 | 30 |
| Front branch only | Frame (ms) | 27 | 28 | 30 |
| Both branches | Rendering (ms) | 16 | 17 | 18 |
| Front branch only | Rendering (ms) | 17 | 16 | 18 |
| Both branches | Shading (ms) | 6 | 6 | 7 |
| Front branch only | Shading (ms) | 5 | 6 | 7 |
| Both branches | Draw calls | 1284 | 1284 | 1284 |
| Front branch only | Draw calls | 1284 | 1284 | 1284 |

Frame, shading, draw-call, and p95 rendering measurements are unchanged. The
1 ms current/median variations are browser timing noise. Rear regions now skip
one crest gradient and one `fillRect()`, so the change adds no work.

## Current crest-pass cost

The active front-only crest pass was measured against the same renderer with
only that pass temporarily disabled. Each case used 10 warm-up frames and 30
measured frames in Firefox headless.

| Scene | Crest | Frame median / p95 | Rendering median / p95 | Shading median / p95 | Draw calls | Crest regions / gradients |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 5000 columns / 50 periods | Disabled | 13 / 15 ms | 10 / 11 ms | 1 / 2 ms | 706 | 0 |
| 5000 columns / 50 periods | Enabled | 14 / 16 ms | 10 / 11 ms | 3 / 4 ms | 706 | 50 |
| 55000 columns / 550 periods | Disabled | 38 / 39 ms | 19 / 21 ms | 3 / 3 ms | 1284 | 0 |
| 55000 columns / 550 periods | Enabled | 41 / 45 ms | 19 / 21 ms | 6 / 7 ms | 1284 | 91 |

The crest adds one gradient and one `fillRect()` per visible front fold region.
It does not change source-column `drawImage()` calls or measured rendering time;
its cost appears in the shading/overlay phase.
