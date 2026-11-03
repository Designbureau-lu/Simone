# SIMONE pre-launch audit

Date: 2026-11-03. Local preparation reviewed and validated; no push or deployment performed.

## Reviewed launch-preparation changes

- Added `src/config.js` with `DEVELOPMENT_ENABLED = false`. DEV starts hidden
  in HTML and remains hidden when the application binds controls. The panel
  code remains intact; setting the flag to true restores its normal behavior.
  Existing `display:none` rules prevent reserved space. No design CSS changed.
- Gated normal application startup console summaries and the developer
  comparison shortcut behind the same flag. Error reporting remains enabled.
- Updated interface assertions for production hiding and explicit reactivation.

## Checks passed

- All static HTML/CSS asset references and relative module imports exist.
  JavaScript syntax checks pass for all 27 entry/source modules, including
  the new configuration module. Both locale files parse.
- Production catalog parsing and source adapters validate 48 projects,
  136 columns, and 68,000 × 2,500 intrinsic units. Both source directories
  exactly match their expected 48 JPEGs; all 96 generated URLs resolve.
  All 96 JPEGs fully decode and have their exact expected SOURCE A/B dimensions.
- A temporary local HTTP server returned complete successful responses for
  104 resources, including all 96 JPEGs, catalog, locales, entry assets, and PDF.
  JavaScript and PDF MIME types are correct. This checks local serving, not
  remote GitHub Pages configuration or browser loading.
- PDF parses as 49 unencrypted pages, has valid signature/EOF, and the download
  anchor retains `SIMONE-presentation-download.pdf`. Both button labels and
  the existing language bindings are correct. Native download behavior still
  needs browser verification, particularly iOS Safari.
- EN/FR Presentation and biography use the approved copy with no Lorem ipsum
  or English placeholders. Translation key coverage, HTML English fallbacks,
  inline emphasis, and PDF label switching pass existing translation checks.
  This verifies consistency with approved copy, not independent editorial approval.
- The external Press release URL resolves to the expected Ministry of Culture
  announcement. Telephone/email anchors are syntactically valid; calling or
  sending email was not tested.
- Catalog tests: 20/20; navigation: 9/9; interaction/reframing: 66/66;
  targeted interface checks: 5/5 (including DEV reactivation); editorial structure checks: 2/2. These ran in
  Node with a DOM emulator and filesystem fetch/result shims, not a browser.
  Translation tests: 14/15; the remaining native-button tabIndex assertion is
  blocked by the emulator's default -1 instead of the browser's 0.
- `git diff --check` passes. No curtain pixels, geometry, typography, or layout
  rules were edited. No obsolete production curtain asset references found.

## Launch decisions and outstanding verification

1. **Inactive public actions:** Video interview / Entretien vidéo and
   Plan my visit / Planifier ma visite are visible buttons with no assigned
   behavior. The user explicitly requested leaving both unchanged for now;
   the client will probably supply or replace destinations later. This local
   preparation does not change their visibility, content, or behaviour.
2. **Browser QA remains required:** no browser is connected to this session.
   Live console errors, responsive rendering/overflow in both languages,
   keyboard focus, Index selection, READ/EXPLORE transitions, desktop drag/wheel,
   touch pan/pinch, language switching during interaction, and real PDF download
   were not verified. Check 320, 390, 768, 1119, 1120, 1440, and 1920 px, plus
   desktop Safari/Chrome and a real iOS device. Do not treat the Node interaction
   tests as visual or native-event sign-off.
3. **Browser-only suites remain unverified:** full interface and canvas/artwork
   suites require native browser layout, Image decoding, and Canvas. Performance
   tests were attempted in the emulator but all three were blocked by its DOM
   constructor behavior; this is not evidence of a website regression.
4. **Deployment:** `.nojekyll` exists; the static deployment uploads the repository
   root. The GitHub workflow publishes automatically on pushes to `main` and
   permits manual dispatch. Its configuration was inspected without invoking
   Actions. Remote Pages settings, final domain/HTTPS, and deployed MIME types
   still require verification when deployment is authorized. Tests, source and
   documentation are included by the current root-upload policy.

The flag controls DEV UI, startup summaries, and the comparison shortcut; it is
not an access-control mechanism. Existing explicitly requested diagnostic query
parameters (`debug-artwork-source`, `debug-fold-regions`) remain supported.
There are no public links to them. Legacy diagnostic logs remain in the unused
`SimoneApplication` implementation; the public entry uses `ViewportApplication`.
