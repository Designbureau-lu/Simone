# SIMONE translations

The site remains one HTML page. `en.json` and `fr.json` contain public text;
`src/i18n/i18n.js` loads and validates them without a framework or build step.

## Current French status

Presentation now contains the final supplied EN/FR copy: three paragraphs,
two bold museum-section labels, and eight separate floor entries. Artwork
italics and floor-label emphasis follow the supplied copy exactly, including
the unitalicized French Pavillons de Saint-Nazaire and punctuation outside
500 pièces. Copy uses Unicode text and supported inline tags, without copied
HTML character entities.

Public interface/accessibility labels now have straightforward French
equivalents, including `Communiqué de presse`, `Entretien vidéo`,
`Planifier ma visite`, `PRÉSENTATION`, and `VERNISSAGE`. INDEX, institution and
artwork names, dates, links, and logo lettering remain unchanged.

Biography now uses the final supplied English and French texts. Neither
locale has English placeholders; approved French biography is marked `lang="fr"`.
Developer controls stay English.

Client-approved visitor copy uses `Presentation at the Nationalmusée um
Fëschmaart` / `Présentation au Nationalmusée um Fëschmaart`, without Kapellchen.
The French event heading is `VERNISSAGE`; the English heading remains `OPENING`.

## Editing copy

1. Edit the relevant string in `en.json` or `fr.json`, preserving its key.
2. When approved French replaces an English placeholder, remove that exact key
   from `fr.json`'s `_meta.englishPlaceholders` array. Entries still listed there
   must remain identical to English. Mixed approved/pending copy is supported.
3. Preserve artwork titles, proper names, dates, addresses, phone/email,
   asset paths, project catalog data, and link destinations. Preserve the exact
   accented museum name `Nationalmusée um Fëschmaart` in `visit.location`.
4. Plain labels accept text only. Paragraphs bound with `data-i18n-rich` accept
   only properly nested `<em>` and `<strong>` tags, without attributes.
   Links, headings, lists, scripts, styles, and arbitrary HTML are rejected.
5. Preserve `{current}`, `{total}`, and `{title}` in `navigation.position`.
   Their order can change. Project titles are inserted as text, never HTML.
6. Keep the same complete key set in both dictionaries. A new public text key
   also needs an HTML binding, or a dynamic binding in the translation module.
7. If English copy changes, synchronize its existing HTML/JavaScript English
   fallback as well, and update any still-English French placeholders to match.
   The translation test checks the static fallback against
   English JSON. Runtime JSON edits take effect when the page loads; no build
   is required. JSON uses double quotes and cannot contain comments.

Proper-name headings, the SVG identity, INDEX (shared by both languages),
artwork titles/years, date/time values, logos, and their original-language
lettering are deliberately outside translation. Descriptive accessibility
labels and logo alternative text are included where wording needs translation.

Video interview remains inactive. The visit action opens the official museum
practical-information page in a new tab with `noopener noreferrer`. Its EN/FR
destinations live in `data-language-href-en` / `data-language-href-fr` on the
existing anchor; the translation controller updates `href` when it successfully
applies a language. English HTML provides the no-JavaScript fallback.
The existing press-release URL is unchanged in both languages.

## Selection and failure behavior

A valid saved `simone.language` choice (`en` or `fr`) wins. Otherwise the first
browser language preference is used: `fr` and `fr-*` select French; all other
values select English. Only explicit selections are saved. Storage access can
fail without preventing switching.

English JSON is validated first, followed by the requested dictionary. Failed
loads or validation leave the displayed language/content intact; on first load
this is the readable English HTML fallback. Errors are reported in the console.
A failed request can be retried. Dictionaries are cached and the latest language
request wins. Language switching does not reload the page or invoke artwork,
geometry, navigation, or entrance initialization.

## Validation and review

Serve the repository over HTTP, for example `python3 -m http.server 8000`, then
open `http://localhost:8000/tests/I18n.test.html`. This validates both actual
locale files, key coverage, English placeholders, interpolation, inline markup,
selection priority, persistence, failure behavior, and request races.
Run all other existing `tests/*.test.html` pages as regression checks.

Missing/unknown keys, invalid JSON/metadata, non-string or empty values,
unsupported/malformed markup, and mismatched placeholders reject the candidate
dictionary before it changes the page.

Review EN and FR at 320, 390, 768, 1440, and 1920 px, including keyboard focus,
open project menus, switching at a nonzero scroll position, and text overflow.
French copy wraps differently and changes editorial height. Recheck future
copy updates rather than changing typography or shrinking text automatically.

## Museum communications update (2026-11-04)

Both introductions explicitly name Nationalmusée um Fëschmaart. The coins and
medals section adds the Étage/Level +2 stone entry with the exact italic title
Le Va-et-Vient du Mont Saint-Watou. All French floor labels use Étage.
`actions.downloadPresentation` uses “Download presentation” in EN. The leaflet
review label uses `actions.downloadLeaflet`; no PDF destination is assigned.
Its visibility flag is documented in the project README. Konschtlexikon is a
shared proper-name link above Video interview, with the same URL in both
languages. The visit destinations continue to follow the successfully applied
language using the existing localized-link binding.
