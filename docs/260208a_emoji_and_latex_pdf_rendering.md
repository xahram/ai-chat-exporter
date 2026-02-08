# Emoji & LaTeX Rendering in PDF Export

## Goal

Make exported PDFs faithfully render:
1. **Emoji glyphs** — actual emoji characters, not text labels like `[thumbs up]`
2. **LaTeX equations** — beautifully formatted math, not raw LaTeX source text

The extension exports Claude, ChatGPT, and Gemini conversations to PDF using jsPDF 2.5.1.

## Context

- jsPDF 2.5.1 uses `charCodeAt()` internally — cannot handle codepoints above U+FFFF (supplementary plane)
- jsPDF **only reads cmap format 4** (BMP). Format 12 subtables are ignored entirely
- ChatGPT and Claude both use KaTeX with dual rendering: `.katex-mathml` (hidden) + `.katex-html` (visible). `textContent` grabs both, producing duplicated garbled output

## References

- `src/popup/pdf-exporter.js` — Core PDF generation, emoji PUA mapping, `normalizeText()`
- `src/content/chatgpt-extractor.js` — ChatGPT DOM extraction, KaTeX handling
- `src/content/claude-extractor.js` — Claude DOM extraction, KaTeX handling
- `src/content/gemini-extractor.js` — Gemini DOM extraction (already had bold handling)
- `lib/emoji-font.js` — Base64-encoded PUA-remapped Noto Emoji subset font
- `test-pdf/build-font.py` — Font build script (fontTools)
- `test-pdf/test-final.js` — Full pipeline end-to-end test
- `test-pdf/test-verify.js` — Mapping verification test

## Principles & Key Decisions

- **PUA remapping approach**: Remap all emoji codepoints to Private Use Area (U+E000+) in a custom subset font, then convert emoji chars to PUA equivalents in `normalizeText()` before PDF rendering. This is the only way to get actual emoji glyphs in jsPDF.
- **No text labels**: User explicitly rejected `[thumbs up]` style text replacements. Must render actual emoji glyphs.
- **335 emoji coverage**: Font includes 335 common emoji mapped to PUA range E000-E14E.
- **Font build uses fontTools**: Must read glyph names from `getBestCmap()` AFTER subsetting, then build new format 4 cmap. Reading before subsetting causes wrong mapping.
- **Bold text**: Extractors convert `<b>`/`<strong>` to `**markdown**` markers; PDF renderer parses and renders bold segments inline.
- **KaTeX extraction**: Extract from `annotation[encoding="application/x-tex"]` to get clean LaTeX source, avoiding the duplicated garbled `textContent`.

## Stages & Actions

### ✅ Stage: Emoji font pipeline — PUA remapping approach
- ✅ Discovered jsPDF limitation: `charCodeAt()` can't handle supplementary plane, only reads cmap format 4
- ✅ Built initial PUA-remapped font with `test-pdf/build-font.py` using fontTools
- ✅ Created `EMOJI_TO_PUA` map in `pdf-exporter.js` (initially ~106 entries)
- ✅ Added `getEmojiPUA()`, `isPUAEmoji()`, `splitEmojiRuns()` methods
- ✅ Updated `normalizeText()` to convert BMP and supplementary emoji to PUA
- ✅ Added `renderFormattedLine()` with inline emoji font switching

### ✅ Stage: Fix format 4 cmap — only 21 of 106 glyphs rendered
- ✅ Diagnosed: old font had 21 glyphs in format 4 but 106 in format 12 — jsPDF only reads format 4
- ✅ Rewrote `build-font.py` to force ALL PUA mappings into format 4 cmap
- ✅ Verified all glyphs now render in `test-pdf/test2.js` (106/106)

### ✅ Stage: Fix wrong glyph mapping (brain showed as poop emoji)
- ✅ Root cause: reading glyph names from pre-subset cmap — subsetter renames/reorders glyphs
- ✅ Fix: read `getBestCmap()` AFTER subsetting to get correct post-subset glyph names
- ✅ Rebuilt font; verified correct mapping in `test-pdf/test-verify.js` and `test-pdf/test-verify.pdf`

### ✅ Stage: Expand to 335 emoji
- ✅ Updated `EMOJI_CODEPOINTS` list in `build-font.py` to 335 entries (faces, hands, hearts, symbols, objects, animals, food, weather, etc.)
- ✅ Rebuilt font — 152KB TTF, 203KB as base64 JS
- ✅ Generated new `EMOJI_TO_PUA` map with `test-pdf/gen-map.py`
- ✅ Updated `pdf-exporter.js`: 335-entry map, `isPUAEmoji` range to `0xE14E`, BMP regex to `[\u231A-\u27BF\u2934-\u2935\u2B05-\u2B55]`, splitTextToSize PUA regex to `[\uE000-\uE14E]`
- ✅ Verified all 335 glyphs render in `test-pdf/test3.js`

### ✅ Stage: End-to-end pipeline test
- ✅ Created `test-pdf/test-final.js`: real emoji strings -> `normalizeText()` -> PUA -> jsPDF rendering
- ✅ Verified 16 test strings with emoji render correctly in `test-pdf/test-final.pdf`
- ✅ Full pipeline confirmed working: emoji chars in source text appear as actual glyphs in PDF

### ✅ Stage: Bold text rendering
- ✅ Added `<b>`/`<strong>` -> `**markdown**` conversion in `claude-extractor.js` and `chatgpt-extractor.js`
  - 📔 Gemini extractor already had this at lines 264-267
- ✅ Added `parseBoldSegments()` method in `pdf-exporter.js`
- ✅ Refactored `renderTextPart()` to parse bold markers per line and render segments with font switching
- ✅ Added `renderFormattedLine()` that handles both bold and emoji font switching inline

### ✅ Stage: KaTeX/LaTeX extraction fix
- ✅ ChatGPT extractor: extract LaTeX from `annotation[encoding="application/x-tex"]` instead of garbled `textContent`
- ✅ Claude extractor: same KaTeX handling
- ✅ Currently converts LaTeX source to readable plain text (e.g., `\frac{p}{100}` -> `(p/100)`)
  - 📔 This is the interim solution — next stage replaces it with beautiful rendered equations

### ✅ Stage: Beautiful LaTeX equation rendering in PDF

**Requirement**: Equations must look like proper typeset LaTeX (fractions, integrals, summations, matrices etc.) — NOT plain text approximations. The PDF should look as close to a LaTeX document as possible.

**Approach chosen**: MathJax `tex-svg.js` (2MB raw, ~680KB gzipped)
- Ships as `lib/tex-svg.js` — single self-contained file, no fonts/CSS needed
- In the browser popup: `MathJax.tex2svgPromise(latex)` → SVG element → Canvas → PNG data URL → `jsPDF.addImage()`
- Produces crisp vector SVG which gets rasterized at 3x for retina-quality output

**Constraint**: Keep extension size as low as practical. MathJax adds ~680KB compressed to the ~260KB current extension (~940KB total). Acceptable.

**Pipeline**:
1. Extractors preserve raw LaTeX in `$$..$$` (display) / `$...$` (inline) delimiters
2. `pdf-exporter.js` `parseContent()` detects LaTeX blocks alongside code/table blocks
3. For each LaTeX block: `MathJax.tex2svgPromise()` → SVG → Canvas → PNG → `addImage()`
4. Inline math rendered at smaller scale, embedded inline with text

#### Actions
- ✅ Create `test-pdf/test-latex-browser.html` — standalone browser test page
  - Uses local `tex-svg.js` + `jspdf.umd.min.js`
  - Renders 11 test equations (fractions, integrals, sums, matrices, inline)
  - **Verified**: all equations render beautifully in PDF
  - Key fix: replace `currentColor` with `#000000` in SVG before rasterizing, add white canvas background
- ✅ Verify prototype PDF has beautiful LaTeX equations before proceeding
- ✅ Update extractors: replace plain-text LaTeX conversion with `$$..$$` / `$...$` delimiters
  - `chatgpt-extractor.js`: KaTeX handler preserves raw LaTeX
  - `claude-extractor.js`: KaTeX handler preserves raw LaTeX
  - `gemini-extractor.js`: KaTeX handler added (Gemini also uses KaTeX)
- ✅ Add `lib/tex-svg.js` to `manifest.json` `web_accessible_resources`
- ✅ Update `pdf-exporter.js`:
  - `loadLibrary()` loads MathJax with SVG output config
  - `latexToPng(tex, display, scale)`: MathJax → SVG → Canvas → PNG
  - `parseContent()` detects `$$..$$` (display) and `$...$` (inline) alongside code/tables
  - `renderLatexBlock(part)`: embeds equation PNG centered (display) or left-aligned (inline)
  - `export()`, `renderMessages()`, `renderMessage()`, `renderMessageContent()` all async
  - `normalizeText()` only runs on text parts, not LaTeX (parse first, normalize text parts only)
- ✅ Build extension zip (928KB)
- ✅ Test with real ChatGPT math conversation in Firefox — LaTeX renders beautifully
- [ ] Test with real Claude math conversation in Firefox
- [ ] Test with real Gemini math conversation in Firefox
- [ ] Verify plain conversations (no math) produce identical output

### ✅ Stage: Fix emoji rendering in extension (was broken)
**Root cause 1**: `lib/emoji-font.js` used `const EMOJI_FONT_BASE64` — Firefox extension popups don't attach `const` declarations to `window`, so `window.EMOJI_FONT_BASE64` was `undefined`. `pdf-exporter.js` checks `window.EMOJI_FONT_BASE64`, so font was never registered.
- ✅ Fix: changed `const` to `var` in `emoji-font.js`

**Root cause 2**: `doc.getTextWidth()` crashes on custom fonts — `metadata.Unicode.widths` is undefined for fonts added via `addFileToVFS`. jsPDF's `doc.text()` works (different code path) but width measurement fails.
- ✅ Fix: estimate emoji width from actual font metrics instead of calling `getTextWidth()`
- All NotoEmoji PUA glyphs have advance=2600, unitsPerEm=2048, ratio=1.27
- Width formula: `run.text.length * fontSize * 1.27 * 25.4 / 72` (pt → mm)

**Verification**: Created `test-pdf/test-emoji-debug.html` test page confirming:
- PUA mapping works correctly (🧠→0xE14B, 🤔→0xE0C3)
- Font registration succeeds
- Emoji render as actual glyphs in PDF with correct spacing

### Stage: Final integration & testing
- [ ] Test with real Claude math conversation in Firefox
- [ ] Test with real Gemini math conversation in Firefox
- [ ] Test full extension with emoji + math + bold combined
- [ ] Verify plain conversations produce identical output to before
- [ ] Final extension zip
- [ ] Update planning doc, mark all done

## Appendix

### Font build process
1. Load `NotoEmoji-Regular.ttf` from `/tmp/`
2. Subset with `fontTools.subset.Subsetter()` using original codepoints
3. Read post-subset cmap via `getBestCmap()` to get correct glyph names
4. Build new format 4 cmap mapping PUA codepoints (E000+) to those glyph names
5. Remove variation tables (GSUB, fvar, gvar, HVAR, VVAR, STAT)
6. Base64 encode and write to `lib/emoji-font.js`

### normalizeText() flow
1. Keycap sequences (1️⃣) -> "1." before stripping
2. Smart quotes, arrows, symbols -> ASCII equivalents
3. Zero-width chars, variation selectors -> removed
4. BMP emoji (U+231A-U+27BF, U+2934-U+2935, U+2B05-U+2B55) -> PUA via `getEmojiPUA()`
5. Supplementary emoji (U+1F300-U+1F9FF) -> PUA via `getEmojiPUA()`
6. Final filter: only allow ASCII, extended Latin, and PUA chars

### Key discovery: jsPDF cmap format limitation
The old font built with `pyftsubset` put BMP-origin emojis into cmap format 4 but supplementary plane emojis only into format 12. jsPDF ignores format 12 entirely. This is why only ~21 emoji rendered out of 106. Fixed by manually building the cmap table in Python, forcing all entries into format 4.

### LaTeX rendering: approaches considered
| Approach | Size | Pros | Cons |
|----------|------|------|------|
| MathJax `tex-svg.js` | 2MB (680KB gz) | Single file, no fonts needed, clean SVG output | Largest |
| KaTeX + CSS + fonts | ~400KB raw | Smaller JS | Needs CSS + font files, HTML output needs canvas conversion |
| Capture from page DOM | 0KB | No extra files | Complex, unreliable across page layouts, content script limitations |
| Plain text conversion | 0KB | Simplest | Looks terrible — `(a/b)` instead of a proper fraction |

**Decision**: MathJax chosen for simplicity (one file, direct SVG output) and quality. ~680KB compressed is acceptable for proper math rendering.

### Alternative approach rejected
Text labels like `[thumbs up]` were tried and explicitly rejected by the user. The PUA font remapping approach is the correct solution.
