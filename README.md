# AI Chat Exporter

A Firefox browser extension that exports AI chat conversations to well-formatted PDF documents.

## Supported Platforms

- **Claude.ai** - https://claude.ai
- **ChatGPT** - https://chat.openai.com & https://chatgpt.com
- **Gemini** - https://gemini.google.com

## Features

- **PDF Export**: Generate clean, readable PDFs from any conversation
- **Multi-Platform**: Supports Claude.ai, ChatGPT, and Google Gemini
- **Smart Extraction**: Automatically identifies the active chat, ignoring sidebar content
- **Code Preservation**: Maintains code blocks with language labels and monospace formatting
- **List Support**: Preserves bullet points and numbered lists with proper indentation
- **Table Support**: Renders markdown-style tables with headers and borders
- **Bold Text**: Preserves bold/strong formatting from all platforms
- **Emoji Rendering**: Renders 335 common emoji as actual glyphs using a custom PUA-remapped font
- **LaTeX Equations**: Renders mathematical equations beautifully using MathJax (SVG to PNG pipeline)
- **Horizontal Rules**: Preserves `<hr>` dividers as graphical lines in the PDF
- **Customizable Settings**: Configure header colors, display names, and font sizes (persisted across sessions)
- **Clean Formatting**: Colored header bars (blue=user, orange=Claude, green=ChatGPT, purple=Gemini)

## Installation

### Temporary Installation (Development)

1. Open Firefox and navigate to `about:debugging`
2. Click **"This Firefox"** in the left sidebar
3. Click **"Load Temporary Add-on"**
4. Navigate to this directory and select `manifest.json`

### Permanent Installation

Install from [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/ai-chat-exporter/).

## Usage

1. Navigate to [claude.ai](https://claude.ai), [chatgpt.com](https://chatgpt.com), or [gemini.google.com](https://gemini.google.com) and open a conversation
2. Click the extension icon in the Firefox toolbar
3. Click **"Export as PDF"**
4. Choose a save location when prompted

### Settings

Click the gear icon in the popup to customize:
- Display names for user and AI headers
- Header bar colors per platform
- Content and header font sizes
- All settings persist across browser sessions

## Project Structure

```
ai-chat-exporter/
├── manifest.json                    # Extension manifest
├── README.md                        # This file
│
├── docs/
│   ├── ARCHITECTURE.md              # Technical architecture deep-dive
│   ├── CHANGELOG.md                 # Version history
│   ├── PLAN.md                      # Bold text & emoji plan (historical)
│   ├── PLAN-SETTINGS.md             # Settings feature plan (historical)
│   └── 260208a_emoji_and_latex_pdf_rendering.md  # Emoji & LaTeX implementation log
│
├── scripts/
│   ├── build-font.py                # Emoji font builder (fontTools)
│   └── gen-map.py                   # Emoji PUA map generator
│
├── lib/
│   ├── jspdf.umd.min.js            # jsPDF 2.5.1 - PDF generation
│   ├── emoji-font.js               # PUA-remapped Noto Emoji subset (335 glyphs)
│   └── tex-svg.js                   # MathJax tex-to-SVG bundle
│
├── src/
│   ├── background/
│   │   └── background.js           # Service worker for file downloads
│   │
│   ├── content/
│   │   ├── claude-extractor.js      # Claude DOM extraction
│   │   ├── chatgpt-extractor.js     # ChatGPT DOM extraction
│   │   └── gemini-extractor.js      # Gemini DOM extraction
│   │
│   └── popup/
│       ├── popup.html               # Extension popup markup
│       ├── popup.css                # Popup styles
│       ├── popup.js                 # Popup controller & settings
│       └── pdf-exporter.js          # PDF document generator
│
└── assets/
    └── icons/
        ├── icon-48.png              # Toolbar icon
        └── icon-96.png              # High-DPI toolbar icon
```

## How It Works

### Extraction Pipeline

Each platform has a dedicated content script that runs on the chat page:

1. **Find chat container** - Locates the main conversation area (excludes sidebar)
2. **Extract messages** - Iterates through user/assistant message pairs
3. **Preserve formatting** - Converts DOM elements to markdown-style text:
   - Code blocks: `` ```language ... ``` ``
   - Bold: `**text**`
   - Lists: `- item` / `1. item`
   - Tables: `| col | col |`
   - LaTeX: `$$equation$$` / `$inline$`
   - Horizontal rules: `---`
4. **KaTeX handling** - Extracts raw LaTeX from `annotation[encoding="application/x-tex"]` to avoid duplicated garbled output from KaTeX's dual rendering

### PDF Rendering

The PDF exporter (`pdf-exporter.js`) processes the extracted markdown-style content:

1. **Text normalization** - Converts Unicode to PDF-safe characters, maps emoji to PUA codepoints
2. **Content parsing** - Splits into text, code blocks, tables, and LaTeX blocks
3. **Bold rendering** - Parses `**markers**` and renders with font weight switching
4. **Emoji rendering** - Switches to NotoEmoji font for PUA characters, estimates width from font metrics (advance=2600, unitsPerEm=2048)
5. **LaTeX rendering** - MathJax SVG -> Canvas -> PNG -> `jsPDF.addImage()`
6. **Horizontal rules** - Detected as `---` lines, rendered as graphical lines with spacing

### Message Flow

```
User clicks "Export as PDF"
  -> popup.js detects platform
  -> Injects appropriate content script
  -> Content script extracts conversation data
  -> PDFExporter.export(data, platform, settings)
  -> Loads jsPDF, emoji font, MathJax
  -> Renders header, messages, code, tables, math
  -> Sends base64 PDF to background script
  -> background.js triggers browser download
```

## Browser Permissions

| Permission | Reason |
|------------|--------|
| `activeTab` | Access current tab to inject content script |
| `downloads` | Save generated PDF files |
| `storage` | Persist user settings across sessions |

## Dependencies

- **jsPDF 2.5.1** - PDF generation
- **MathJax 3** (tex-svg.js) - LaTeX equation rendering
- **Noto Emoji** (subset) - Emoji glyph rendering via PUA remapping

## Documentation

- [Architecture](docs/ARCHITECTURE.md) - Technical deep-dive into extension contexts, data flow, and component design
- [Changelog](docs/CHANGELOG.md) - Version history and release notes
- [Emoji & LaTeX Implementation](docs/260208a_emoji_and_latex_pdf_rendering.md) - Detailed implementation log for emoji PUA remapping and LaTeX rendering

## Troubleshooting

### "No messages found"
- Ensure you're on a conversation page (not the home page)
- The chat must have at least one exchange

### Emoji not rendering
- The extension includes 335 common emoji. Unsupported emoji are silently omitted
- If no emoji render at all, check the browser console for font loading errors

### LaTeX equations showing as raw text
- MathJax needs a moment to initialize on first export
- If equations consistently fail, check the browser console for MathJax errors

### Extension not appearing
- Check `about:debugging` for errors
- Ensure manifest.json is valid JSON

## License

MIT
