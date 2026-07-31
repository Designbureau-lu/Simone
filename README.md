# SIMONE

SIMONE is a folded-surface engine for presenting immutable graphical content on
periodic circular folds. It prioritizes visual continuity, artwork readability,
and interactive performance over strict cloth simulation.

The active geometry is `CircularFoldSurface`; user interaction is expressed
through Visible Factor and classified by `OperatingPhaseResolver`.

## Current rendering model

SIMONE treats the curtain and its printed artwork as separate resolutions of
one scene:

- The curtain is the physical model. Every Period and its cumulative position
  remain part of one global mathematical curtain on every frame.
- The artwork is sampled from that model. Exact pixel-column geometry is
  calculated only for Periods intersecting or approaching the viewport.
- The camera, semantic positions, and artwork coordinates remain global.
  Demand-driven sampling never creates a viewport-relative curtain or artwork.
- A sampled column uses the same arc equations, source pixels, shading, and
  destination coordinates as a full-artwork calculation, so rendered output
  is unchanged.
- Ordered dimensions in `public/artwork.json` establish the complete virtual
  artwork before decoding. Only segments required by the initial viewport and
  guard region block the first curtain; remaining segments load through the
  same metadata-backed artwork in the background.

See [SIMONE.md](SIMONE.md) for the design philosophy, architecture, geometry and
rendering pipelines, intentional approximations, limitations, and research
directions.
