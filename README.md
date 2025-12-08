# AI Chat Exporter

A Firefox browser extension that exports AI chat conversations to well-formatted PDF documents.

## Supported Platforms

- **Claude.ai** - https://claude.ai
- **ChatGPT** - https://chat.openai.com & https://chatgpt.com

## Features

- **PDF Export**: Generate clean, readable PDFs from any conversation
- **Multi-Platform**: Supports both Claude.ai and ChatGPT
- **Smart Extraction**: Automatically identifies the active chat, ignoring sidebar content
- **Code Preservation**: Maintains code blocks with language labels
- **List Support**: Preserves bullet points and numbered lists
- **Table Support**: Renders tables from ChatGPT conversations
- **Clean Formatting**: Clear visual distinction between user and assistant messages

## Installation

### Temporary Installation (Development)

1. Open Firefox and navigate to `about:debugging`
2. Click **"This Firefox"** in the left sidebar
3. Click **"Load Temporary Add-on"**
4. Navigate to this directory and select `manifest.json`

### Permanent Installation

Package the extension as an `.xpi` file and submit to Firefox Add-ons.

## Usage

1. Navigate to [claude.ai](https://claude.ai) or [chatgpt.com](https://chatgpt.com) and open a conversation
2. Click the extension icon in the Firefox toolbar
3. Click **"Export as PDF"**
4. Choose a save location when prompted

## Project Structure

```
ai-chat-exporter/
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
│   │   ├── extractor.js         # DOM parser for Claude chat extraction
│   │   └── chatgpt-extractor.js # DOM parser for ChatGPT chat extraction
│   │
│   └── popup/
│       ├── popup.html           # Extension popup markup
│       ├── popup.css            # Popup styles
│       ├── popup.js             # Popup controller/orchestrator
│       └── pdf-exporter.js      # PDF document generator
│
└── assets/
    └── icons/
        ├── icon-48.png          # Toolbar icon
        └── icon-96.png          # High-DPI toolbar icon
```

## Component Overview

### 1. Content Scripts (`src/content/`)

**Purpose**: Runs in the context of chat pages to extract conversation data.

#### Claude Extractor (`extractor.js`)

**Key Object**: `ChatExtractor`

| Method | Description |
|--------|-------------|
| `extract()` | Main entry point, returns conversation data object |
| `findChatContainer()` | Locates the main chat area, excluding sidebar |
| `extractMessages()` | Collects all user and Claude messages |
| `extractFormattedText()` | Preserves code blocks, lists, inline code |
| `cleanUserText()` | Removes avatar initials from user messages |

#### ChatGPT Extractor (`chatgpt-extractor.js`)

**Key Object**: `ChatGPTExtractor`

| Method | Description |
|--------|-------------|
| `extract()` | Main entry point, returns conversation data object |
| `findChatContainer()` | Locates the main chat area |
| `extractMessages()` | Collects all user and assistant messages |
| `extractFormattedText()` | Preserves code blocks, lists, tables |

**Output Format**:
```javascript
{
  title: "Conversation Title",
  platform: "claude" | "chatgpt",
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
| `parseListItem()` | Detects bullets and numbers |

**PDF Structure**:
- Header: Title + export timestamp
- Messages: Colored header bar (blue=user, orange=Claude, green=ChatGPT) + content
- Code blocks: Gray background, monospace font, language label
- Lists: Proper indentation with bullet/number preservation
- Tables: Markdown-style table rendering

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
         ├──► Detects platform (Claude/ChatGPT)
         │
         ├──► Injects appropriate extractor
         │           │
         │           ▼
         │    Extractor.extract()
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

## Browser Permissions

| Permission | Reason |
|------------|--------|
| `activeTab` | Access current tab to inject content script |
| `downloads` | Save generated PDF files |

## Dependencies

- **jsPDF 2.x** (`lib/jspdf.umd.min.js`) - PDF generation library

## Troubleshooting

### "No messages found"
- Ensure you're on a conversation page (not the home page)
- The chat must have at least one exchange

### PDF has wrong content
- The extension extracts from the visible conversation only
- Sidebar chat history is intentionally excluded

### Extension not appearing
- Check `about:debugging` for errors
- Ensure manifest.json is valid JSON

## License

MIT
