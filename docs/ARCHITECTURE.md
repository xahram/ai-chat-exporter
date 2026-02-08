# Architecture Documentation

Technical overview of the AI Chat Exporter Firefox extension.

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FIREFOX BROWSER                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐     ┌─────────────────────────────────────────────┐   │
│  │   POPUP CONTEXT │     │           CHAT PAGE TAB                      │   │
│  │                 │     │   (claude.ai / chatgpt.com / gemini.google)  │   │
│  │  ┌───────────┐  │     │                                              │   │
│  │  │ popup.html│  │     │  ┌────────────────────────────────────────┐ │   │
│  │  │ popup.css │  │     │  │           CONTENT SCRIPT                │ │   │
│  │  │ popup.js  │◄─┼─────┼──┤  claude-extractor.js                   │ │   │
│  │  └───────────┘  │  ①  │  │  chatgpt-extractor.js                  │ │   │
│  │        │        │     │  │  gemini-extractor.js                   │ │   │
│  │        ▼        │     │  └────────────────────────────────────────┘ │   │
│  │  ┌───────────┐  │     │                                              │   │
│  │  │pdf-export │  │     └──────────────────────────────────────────────┘   │
│  │  │   er.js   │  │                                                        │
│  │  └───────────┘  │                                                        │
│  │    │   │   │    │     ┌──────────────────────────────────────────────┐   │
│  │    │   │   │    │     │              LIBRARIES                        │   │
│  │    │   │   └────┼─────┤  lib/jspdf.umd.min.js  (PDF generation)     │   │
│  │    │   └────────┼─────┤  lib/emoji-font.js      (PUA emoji font)    │   │
│  │    └────────────┼─────┤  lib/tex-svg.js         (MathJax LaTeX)     │   │
│  │        │        │     └──────────────────────────────────────────────┘   │
│  └────────┼────────┘                                                        │
│           │ ②                                                                │
│           ▼                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      BACKGROUND SCRIPT                               │   │
│  │  DownloadManager.downloadPDF()                                       │   │
│  │  base64 → Blob → browser.downloads.download()                       │   │
│  └──────────────────────────┬──────────────────────────────────────────┘   │
│                              │ ③                                           │
│                              ▼                                             │
│                    Browser Save Dialog                                      │
└─────────────────────────────────────────────────────────────────────────────┘

① browser.tabs.sendMessage() - Popup requests data from content script
② browser.runtime.sendMessage() - Popup sends PDF to background for download
③ browser.downloads.download() - Background triggers file save
```

## Execution Contexts

### 1. Content Script Context (`src/content/`)

**Runs in**: The chat page (claude.ai, chatgpt.com, gemini.google.com)
**Has access to**: Page DOM, limited extension APIs
**Cannot access**: Cross-origin resources, downloads API

Each platform has its own extractor with platform-specific DOM selectors:

| Extractor | Key Selectors |
|-----------|--------------|
| `claude-extractor.js` | `.font-claude-message-content`, `[class*="bg-bg-300"]` |
| `chatgpt-extractor.js` | `[data-message-author-role]`, `.markdown.prose` |
| `gemini-extractor.js` | `user-query`, `model-response`, `.conversation-container` |

### 2. Popup Context (`src/popup/`)

**Runs in**: Extension popup window
**Has access to**: Full extension APIs, `browser.storage.local` for settings
**Cannot access**: Page DOM directly

Key responsibilities:
- Platform detection from tab URL
- Content script injection
- Settings management (load/save via `browser.storage.local`)
- PDF generation orchestration

### 3. Background Context (`src/background/background.js`)

**Runs in**: Persistent background process
**Has access to**: `browser.downloads` API
**Cannot access**: Any DOM

Needed because the popup can close mid-download. Background script ensures reliable file saves.

## Content Extraction Pipeline

All three extractors follow the same pattern:

```
Page DOM
  │
  ├── Find chat container (exclude sidebar)
  │
  ├── Iterate message pairs (user + assistant)
  │
  └── extractFormattedText(element):
        │
        ├── Clone DOM node
        ├── Remove UI elements (buttons, toolbars, avatars)
        ├── KaTeX → raw LaTeX in $$/$$ delimiters
        ├── <pre><code> → ```language\n...\n```
        ├── <table> → | markdown | table |
        ├── <ul>/<ol> → bullet/numbered lists
        ├── <code> (inline) → `backticks`
        ├── <hr> → \n---\n
        ├── <b>/<strong> → **bold**
        ├── <h1>-<h6> → # headers
        └── textContent → final string
```

### KaTeX Handling

ChatGPT, Claude, and Gemini all use KaTeX with dual rendering:
- `.katex-mathml` (visually hidden, contains MathML)
- `.katex-html` (visible, contains styled spans)

Using `textContent` on a `.katex` element grabs both, producing duplicated garbled output. The fix: extract raw LaTeX from `annotation[encoding="application/x-tex"]` and wrap in `$$`/`$` delimiters for the PDF renderer.

## PDF Rendering Pipeline

`pdf-exporter.js` processes the extracted markdown-style content:

```
Extracted content string
  │
  ├── parseContent() splits into typed blocks:
  │     ├── { type: 'text', content }
  │     ├── { type: 'code', language, content }
  │     ├── { type: 'table', content }
  │     └── { type: 'latex', content, display }
  │
  ├── Text blocks → normalizeText() then renderTextPart()
  │     ├── normalizeText(): Unicode → ASCII, emoji → PUA
  │     ├── Detect --- horizontal rules → graphical line
  │     ├── parseListItem(): bullets/numbers
  │     ├── parseBoldSegments(): **text** → bold font
  │     └── renderFormattedLine(): emoji font switching
  │
  ├── Code blocks → renderCodeBlock()
  │     └── Courier font, gray background, language label
  │
  ├── Tables → renderTable()
  │     └── Column layout, header row, borders
  │
  └── LaTeX blocks → renderLatexBlock()
        └── MathJax SVG → Canvas → PNG → addImage()
```

### Emoji Rendering

jsPDF 2.5.1 uses `charCodeAt()` internally and can only handle BMP codepoints (U+0000-U+FFFF). It also only reads cmap format 4 tables.

**Solution**: Custom subset of Noto Emoji with all 335 glyphs remapped to Private Use Area (U+E000-U+E14E).

```
Original emoji → normalizeText() → PUA char → splitEmojiRuns() → NotoEmoji font
   🧠 U+1F9E0       →            U+E14B     →    isEmoji=true  → doc.setFont('NotoEmoji')
```

Width estimation uses font metrics directly (not `doc.getTextWidth()` which crashes on custom fonts):
- All NotoEmoji PUA glyphs: advance=2600, unitsPerEm=2048, ratio=1.27
- Width = `length * fontSize * 1.27 * 25.4 / 72` (pt to mm)

### LaTeX Rendering

```
Raw LaTeX string
  → MathJax.tex2svgPromise(tex, {display})
  → SVG element
  → Replace currentColor with #000000
  → Serialize to data URL
  → Load into Image
  → Draw onto Canvas (3x scale for retina)
  → canvas.toDataURL('image/png')
  → doc.addImage(dataUrl, 'PNG', x, y, w, h)
```

### Settings System

Settings are stored in `browser.storage.local` under the key `"settings"`:

```js
{
  userDisplayName: "You",        // User message header label
  claudeDisplayName: "",         // Blank = "Claude"
  chatgptDisplayName: "",        // Blank = "ChatGPT"
  geminiDisplayName: "",         // Blank = "Gemini"
  userHeaderColor: "#3B82F6",    // Blue
  claudeHeaderColor: "#D97706",  // Orange
  chatgptHeaderColor: "#10A37F", // Green
  geminiHeaderColor: "#A87FFF",  // Purple
  contentFontSize: 10,           // pt
  headerFontSize: 11             // pt
}
```

Every value has a hardcoded fallback in `pdf-exporter.js`, so the extension works identically with no saved settings.

## Browser Permissions

| Permission | Reason |
|------------|--------|
| `activeTab` | Access current tab to inject content script |
| `downloads` | Save generated PDF files |
| `storage` | Persist user settings across sessions |

## Build Tools (not shipped)

Located in `scripts/`:

- **`build-font.py`** - Builds the PUA-remapped emoji font from Noto Emoji using fontTools
- **`gen-map.py`** - Generates the `EMOJI_TO_PUA` map for `pdf-exporter.js`

These require Python 3 with `fonttools` installed and `NotoEmoji-Regular.ttf` in `/tmp/`.
