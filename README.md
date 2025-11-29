# Claude Chat Exporter

A Firefox browser extension that exports Claude.ai conversations to well-formatted PDF documents.

## Features

- **PDF Export**: Generate clean, readable PDFs from any Claude conversation
- **Smart Extraction**: Automatically identifies the active chat, ignoring sidebar content
- **Code Preservation**: Maintains code blocks with language labels
- **List Support**: Preserves bullet points and numbered lists
- **Clean Formatting**: Clear visual distinction between user and Claude messages

## Installation

### Temporary Installation (Development)

1. Open Firefox and navigate to `about:debugging`
2. Click **"This Firefox"** in the left sidebar
3. Click **"Load Temporary Add-on"**
4. Navigate to this directory and select `manifest.json`

### Permanent Installation

Package the extension as an `.xpi` file and submit to Firefox Add-ons.

## Usage

1. Navigate to [claude.ai](https://claude.ai) and open a conversation
2. Click the extension icon in the Firefox toolbar
3. Click **"Export as PDF"**
4. Choose a save location when prompted

## Project Structure

```
claude-chat-exporter/
├── manifest.json                 # Extension manifest (permissions, scripts, icons)
├── README.md                     # This file
├── ARCHITECTURE.md               # Technical architecture documentation
│
├── lib/
│   └── jspdf.umd.min.js         # jsPDF library for PDF generation
│
├── src/
│   ├── background/
│   │   └── background.js        # Service worker for file downloads
│   │
│   ├── content/
│   │   └── extractor.js         # DOM parser for chat extraction
│   │
│   └── popup/
│       ├── popup.html           # Extension popup markup
│       ├── popup.css            # Popup styles
│       ├── popup.js             # Popup controller/orchestrator
│       └── pdf-exporter.js      # PDF document generator
│
├── assets/
│   └── icons/
│       ├── icon-48.png          # Toolbar icon
│       └── icon-96.png          # High-DPI toolbar icon
│
└── docs/
    ├── sample.pdf               # Example exported PDF
    └── Screenshot...png         # Claude.ai interface reference
```

## Component Overview

### 1. Content Script (`src/content/extractor.js`)

**Purpose**: Runs in the context of claude.ai pages to extract conversation data.

**Key Object**: `ChatExtractor`

| Method | Description |
|--------|-------------|
| `extract()` | Main entry point, returns conversation data object |
| `findChatContainer()` | Locates the main chat area, excluding sidebar |
| `extractMessages()` | Collects all user and Claude messages |
| `extractFormattedText()` | Preserves code blocks, lists, inline code |
| `cleanUserText()` | Removes avatar initials from user messages |

**Output Format**:
```javascript
{
  title: "Conversation Title",
  messages: [
    { role: "user", content: "...", timestamp: "..." },
    { role: "assistant", content: "...", timestamp: "..." }
  ],
  exportDate: "2024-01-01T00:00:00.000Z"
}
```

### 2. Popup UI (`src/popup/`)

**Purpose**: User interface for triggering exports.

**Files**:
- `popup.html` - Minimal markup with single export button
- `popup.css` - Clean, modern styling
- `popup.js` - Controller that orchestrates the export flow

**Key Object**: `PopupController`

| Method | Description |
|--------|-------------|
| `handleExport()` | Main export workflow |
| `injectContentScript()` | Ensures extractor is loaded |
| `extractConversation()` | Requests data from content script |
| `exportToPDF()` | Triggers PDF generation and download |

### 3. PDF Exporter (`src/popup/pdf-exporter.js`)

**Purpose**: Converts conversation data into formatted PDF.

**Key Object**: `PDFExporter`

| Method | Description |
|--------|-------------|
| `export()` | Main entry, returns jsPDF document |
| `renderHeader()` | Title and export date |
| `renderMessage()` | Single message with header and content |
| `renderTextPart()` | Regular text with list detection |
| `renderCodeBlock()` | Formatted code with language label |
| `parseListItem()` | Detects bullets (•, -, *) and numbers |

**PDF Structure**:
- Header: Title + export timestamp
- Messages: Colored header bar (blue=user, orange=Claude) + content
- Code blocks: Gray background, monospace font, language label
- Lists: Proper indentation with bullet/number preservation

### 4. Background Script (`src/background/background.js`)

**Purpose**: Handles file downloads (required due to extension security model).

**Key Object**: `DownloadManager`

| Method | Description |
|--------|-------------|
| `downloadPDF()` | Creates blob from base64 and triggers download |
| `base64ToBlob()` | Converts base64 string to binary Blob |

## Message Flow

```
User clicks "Export as PDF"
         │
         ▼
   PopupController
         │
         ├──► Injects extractor.js (if needed)
         │
         ├──► Sends 'extractConversation' message
         │           │
         │           ▼
         │    ChatExtractor.extract()
         │           │
         │           ▼
         │    Returns conversation data
         │
         ├──► PDFExporter.export(data)
         │           │
         │           ▼
         │    Returns jsPDF document
         │
         ├──► Converts to base64
         │
         └──► Sends 'downloadPDF' to background
                     │
                     ▼
              DownloadManager.downloadPDF()
                     │
                     ▼
              Browser download dialog
```

## DOM Selectors Used

The extension targets these Claude.ai DOM elements:

| Selector | Purpose |
|----------|---------|
| `.font-claude-response-body` | Claude's message content |
| `[class*="bg-bg-300"]` | User message bubbles |
| `div[class*="max-w-3xl"]` | Main chat container |
| `pre > code` | Code blocks |
| `ul`, `ol` | Lists |

**Note**: These selectors may change if Claude.ai updates their UI. Check `extractor.js` if extraction breaks.

## Extending the Extension

### Adding New Export Formats

1. Create new exporter in `src/popup/` (e.g., `json-exporter.js`)
2. Add button to `popup.html`
3. Add handler in `popup.js`
4. Add download handler in `background.js` if needed

### Modifying PDF Layout

Edit `src/popup/pdf-exporter.js`:
- `renderHeader()` - Change title/date formatting
- `renderMessageHeader()` - Modify user/Claude labels
- `renderCodeBlock()` - Adjust code styling
- Colors are RGB values in `doc.setFillColor()` calls

### Fixing Extraction Issues

If chat extraction breaks after Claude.ai updates:

1. Open browser DevTools on claude.ai
2. Inspect the chat message elements
3. Update selectors in `src/content/extractor.js`:
   - `findChatContainer()` - Main container selectors
   - `extractClaudeMessages()` - Claude message selector
   - `extractUserMessages()` - User message selector

## Browser Permissions

| Permission | Reason |
|------------|--------|
| `activeTab` | Access current tab to inject content script |
| `downloads` | Save generated PDF files |

## Dependencies

- **jsPDF 2.x** (`lib/jspdf.umd.min.js`) - PDF generation library

## Troubleshooting

### "No messages found"
- Ensure you're on a claude.ai conversation page (not the home page)
- The chat must have at least one exchange

### PDF has wrong content
- The extension extracts from the visible conversation only
- Sidebar chat history is intentionally excluded

### Extension not appearing
- Check `about:debugging` for errors
- Ensure manifest.json is valid JSON

## License

MIT
