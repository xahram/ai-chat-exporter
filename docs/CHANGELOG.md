# Changelog

All notable changes to AI Chat Exporter will be documented in this file.

## [1.3.0] - 2026-02-08

### Added
- **Emoji rendering**: 335 common emoji render as actual glyphs in PDF using custom PUA-remapped Noto Emoji font
- **LaTeX equation rendering**: Mathematical equations rendered beautifully via MathJax (SVG -> Canvas -> PNG pipeline)
- **Bold text support**: `<b>`/`<strong>` tags preserved as **bold** in PDF for all platforms
- **Horizontal rule support**: `<hr>` dividers rendered as graphical lines with spacing in PDF
- **KaTeX extraction**: Raw LaTeX extracted from `annotation[encoding="application/x-tex"]` to avoid duplicated garbled output
- **MathJax library**: Added `lib/tex-svg.js` for client-side LaTeX rendering

### Fixed
- `emoji-font.js` changed from `const` to `var` — Firefox extension popups don't attach `const` to `window`
- Emoji width estimation uses font metrics instead of `doc.getTextWidth()` which crashes on custom fonts

## [1.2.2] - 2026-02-06

### Added
- **Settings panel**: Gear icon in popup opens customization panel
- Configurable display names for user and AI headers
- Configurable header bar colors per platform
- Configurable content and header font sizes
- Settings persist across sessions via `browser.storage.local`
- Reset to defaults button
- Added `storage` permission to manifest

### Fixed
- macOS color picker stealing focus from popup — replaced with hex text input + color swatch

## [1.2.1] - 2025-01-05

### Added
- Platform-specific PDF header color for Gemini (purple)

### Changed
- Improved title extraction: PDF filenames now include the actual conversation title from the browser tab
- Claude and ChatGPT use `document.title` for accurate titles
- Gemini uses `.conversation-title` element for accurate titles
- Renamed `extractor.js` to `claude-extractor.js` for consistency

## [1.2.0] - 2025-01-05

### Added
- Gemini support: Export conversations from Google Gemini (gemini.google.com)
- New `gemini-extractor.js` for parsing Gemini's DOM structure

### Changed
- Updated manifest.json with Gemini URL pattern
- Updated popup.js to detect and handle Gemini pages
- Updated description to include Gemini

## [1.1.0] - 2024-12-08

### Added
- ChatGPT support: Export conversations from chat.openai.com and chatgpt.com
- Table support for ChatGPT conversations
- Platform detection in popup

### Changed
- Updated PDF exporter to handle multiple platforms
- Different header colors for Claude (orange) and ChatGPT (green)

## [1.0.0] - 2024-11-29

### Added
- Initial release
- Export Claude.ai conversations to PDF
- Code block preservation with language labels
- List support (bullet points and numbered lists)
- Clean formatting with visual distinction between user and assistant messages
- "Show more" detection warning for truncated content
