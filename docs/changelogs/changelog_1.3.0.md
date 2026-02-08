# v1.3.0 - 2026-02-08

## Added
- **Emoji rendering**: 335 common emoji render as actual glyphs in PDF using custom PUA-remapped Noto Emoji font
- **LaTeX equation rendering**: Mathematical equations rendered beautifully via MathJax (SVG -> Canvas -> PNG pipeline)
- **Bold text support**: `<b>`/`<strong>` tags preserved as **bold** in PDF for all platforms
- **Horizontal rule support**: `<hr>` dividers rendered as graphical lines with spacing in PDF
- **Markdown heading support**: `# H1` through `###### H6` rendered as larger bold text in PDF
- **KaTeX extraction**: Raw LaTeX extracted from `annotation[encoding="application/x-tex"]` to avoid duplicated garbled output
- **Gemini LaTeX support**: Extract LaTeX from Gemini's `data-math` attribute on `.math-block` and `.math-inline` elements
- **MathJax library**: Added `lib/tex-svg.js` for client-side LaTeX rendering

## Fixed
- `emoji-font.js` changed from `const` to `var` — Firefox extension popups don't attach `const` to `window`
- Emoji width estimation uses font metrics instead of `doc.getTextWidth()` which crashes on custom fonts
- Gemini headings no longer show as literal `###` text in PDF
