# SIMONE Performance Notes

This document records controlled performance observations. It does not define
optimization decisions.

## Cold-start interaction trace

A clean headless Firefox process and profile loaded the production manifest,
then recorded an idle interval, a 20-step first drag, and an equivalent second
drag. Runtime probes collected animation-frame gaps, Event Timing entries, and
the existing Model C component measurements. Two clean runs showed the same
shape.

No artwork request, image decode, or other resource load occurred during
either drag. All twelve JPEGs had loaded before the idle interval. The active
renderer is Canvas 2D, so WebGL buffers, shaders, and program compilation are
not part of this path. The Viewport-sized backing store remained 1284 × 641;
its reset measured 0–1 ms, and visible-column selection measured 0–1 ms.

The more detailed headless clean run measured:

| Phase | Frame | Geometry | Rendering | Shading |
| --- | ---: | ---: | ---: | ---: |
| Initial production render | 122 ms | 37 ms | 78 ms | 6 ms |
| First interactive render | 115 ms | 41 ms | 67 ms | 6 ms |
| Next first-drag render | 56 ms | 32 ms | 18 ms | 6 ms |
| First-drag steady range | 45–52 ms | 24–29 ms | 14–20 ms | 5–8 ms |
| Second-drag median | 48 ms | 26 ms | 16 ms | 6 ms |

The first clean run similarly measured a 104 ms initial render and a 150 ms
maximum animation-frame gap during the first drag, versus 100 ms during the
second. In the detailed run, first-drag animation-frame gaps reached 117 ms.

One final clean headed run exercised the normal display path at DPR 2 with a
2396 × 1196 backing store:

| Phase | Frame median / p95 | Geometry median / p95 | Rendering median / p95 |
| --- | ---: | ---: | ---: |
| Initial production render | 310 / 310 ms | 35 / 35 ms | 270 / 270 ms |
| First drag | 226 / 426 ms | 29 / 51 ms | 158 / 393 ms |
| Second drag | 100 / 254 ms | 28 / 35 ms | 48 / 225 ms |

The headed trace reproduces the reported large improvement after the first
drag and locates most of it in Canvas drawing. Canvas reset and visible-column
selection remained approximately 0–1 ms. The second drag still contained a few
early outliers before its drawing cost settled around 41–57 ms.
Firefox's GPU-helper diagnostics during this run also reported an unloadable
2D texture fallback and missing optimized WebRender gradient-shader source.
SIMONE does not create WebGL programs, but Firefox may still realize textures
and compile internal compositor shaders while servicing Canvas 2D drawing and
the fold-gradient passes.

The cold penalty therefore occurs inside the same full render pipeline used on
every pointer move. `SimoneApplication.importArtwork()` currently performs only
one render before returning. The next execution is deferred until a control
change or `pointermove`, where `ViewportApplication.render()` regenerates geometry
for all 60,000 artwork columns and then traverses the selected 10,000+ columns
for Canvas drawing. The first two executions pay substantially higher geometry
and Canvas drawing costs before settling.

The evidence is most consistent with first-use Canvas 2D source/destination
resource realization in `ViewportCanvasColumnRenderer.drawColumn()`, plus a
smaller amount of cold JavaScript execution/JIT work in the large geometry and
rendering loops. The source is the 60,000-column assembly canvas produced by
`loadArtwork()`, and the renderer issues thousands of narrow `drawImage()`
operations from that source. It is not consistent with deferred network
loading, canvas resizing, DOM measurement, visible-column selection, or WebGL
setup initiated by application code. Browser-internal Canvas/WebRender texture
and shader warm-up remains part of the likely Canvas realization cost. Object
and array creation inside `#projectGeometry()` remains a significant
steady-state cost, but it repeats on later frames and does not by itself explain
the cold-only difference.

The smallest safe candidate fix is a bounded set of unchanged production render
passes after artwork import, before the interface accepts interaction. Begin
with two additional passes scheduled and awaited on separate animation frames;
increase the bounded count only if the same cold trace shows that drawing has
not stabilized. This warms the exact geometry and Canvas path without changing
curtain state or final visual output. Initialization can therefore be completed
before interaction begins, at the cost of making the existing startup work
explicit rather than charging it to the first visitor gesture. The following
clean headed trace tests that candidate.

### Two-pass warm-up validation

`RENDER_WARMUP_PASSES = 2` was implemented using the unchanged production
renderer on successive animation frames. Curtain state remained untouched and
drag, Reset, and Viewport control entry points remained unavailable until both
passes completed.

The same clean headed Firefox profile measured:

| Phase | Before warm-up | After two passes |
| --- | ---: | ---: |
| First-drag rendering median | 158 ms | 152 ms |
| First-drag rendering p95 | 393 ms | 338 ms |
| Second-drag rendering median | 48 ms | 42 ms |

Interaction now begins only after the requested passes, but it does not begin
fully warmed. The first drag remains visibly much slower than the second.
Moreover, the initial render and two unchanged warm-up passes all retained very
high drawing costs (approximately 462–503 ms in the post-change trace), rather
than converging toward the later 42 ms median.

Two identical-state passes are therefore insufficient. At this stage, the
implementation remained at the requested bounded count of two pending a
controlled comparison of additional identical frames versus representative
deformation states. No renderer or curtain behavior was changed.

### Identical versus deformed warm-up states

Two further clean headed controls tested whether deformation-state diversity,
rather than repetition, was required:

- one strong local deformation frame followed by exact restoration;
- twenty unchanged production frames.

The single deformed-state candidate did not improve the first drag and produced
more erratic cold frames. In contrast, twenty identical frames reduced
first-drag rendering to a 40 ms median and 43 ms p95, matching the later warmed
interaction range. The warm-up therefore does not depend on rendering different
curtain states. It depends on accumulating enough complete production renders
for Firefox's Canvas/WebRender path and the JavaScript loops to settle.

There is consequently no representative deformation-state set to introduce.
The smallest state set is the existing neutral curtain alone. The remaining
tuning question is pass count: two is insufficient and twenty is sufficient,
so a separate bounded pass-count comparison should find the minimum between
them. The production constant was restored to two at this stage; the
twenty-pass value and deformed warm-up were measurement-only variants.

### Warm-up pass-count comparison

Five clean headed Firefox profiles at DPR 2 compared identical neutral-state
production warm-up counts. Temporary Performance marks measured from the first
scheduled warm-up frame through completion of the final pass; those marks were
removed after measurement.

| Passes | Warm-up duration | First-drag rendering median | First-drag rendering p95 | Observation |
| ---: | ---: | ---: | ---: | --- |
| 4 | 2.03 s | 233 ms | 421 ms | Severe first-drag stutter remains. |
| 8 | 4.20 s | 52 ms | 422 ms | Median improves, but a major cold hitch remains. |
| 12 | 5.42 s | 42 ms | 47 ms | First count matching the warmed rendering range. |
| 16 | 5.71 s | 43 ms | 47 ms | No interaction improvement over 12. |
| 20 | 7.11 s | 42 ms | 48 ms | No interaction improvement over 12. |

Twelve is the lowest tested count that makes both first-drag median and p95
effectively match warmed interaction. Four and eight leave visible interaction
problems. Sixteen and twenty only extend startup.

All counts leave the neutral curtain visually unchanged, but startup remains
non-interactive while warming. At twelve passes this interval was approximately
5.4 seconds on the measured machine, which is itself a visible startup delay
and should eventually be communicated by an intentional loading treatment
rather than appearing frozen. The production constant was restored to two
after comparison. The entire production warm-up was subsequently removed; the
measurements remain as investigation history.

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
