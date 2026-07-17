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
