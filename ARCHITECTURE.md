# Architecture Documentation

This document provides a deep technical overview of the Claude Chat Exporter extension for developers and LLMs working on maintenance or feature development.

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FIREFOX BROWSER                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐     ┌─────────────────────────────────────────────┐   │
│  │   POPUP CONTEXT │     │              CLAUDE.AI TAB                   │   │
│  │                 │     │                                              │   │
│  │  ┌───────────┐  │     │  ┌────────────────────────────────────────┐ │   │
│  │  │ popup.html│  │     │  │           CONTENT SCRIPT                │ │   │
│  │  │ popup.css │  │     │  │                                        │ │   │
│  │  │ popup.js  │◄─┼─────┼──┤  extractor.js                          │ │   │
│  │  └───────────┘  │  ①  │  │                                        │ │   │
│  │        │        │     │  │  ┌──────────────────────────────────┐  │ │   │
│  │        ▼        │     │  │  │        ChatExtractor             │  │ │   │
│  │  ┌───────────┐  │     │  │  │  - findChatContainer()           │  │ │   │
│  │  │pdf-export │  │     │  │  │  - extractMessages()             │  │ │   │
│  │  │   er.js   │  │     │  │  │  - extractFormattedText()        │  │ │   │
│  │  └───────────┘  │     │  │  └──────────────────────────────────┘  │ │   │
│  │        │        │     │  │                                        │ │   │
│  └────────┼────────┘     │  └────────────────────────────────────────┘ │   │
│           │              │                                              │   │
│           │ ②            └──────────────────────────────────────────────┘   │
│           ▼                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      BACKGROUND SCRIPT                               │   │
│  │                                                                      │   │
│  │  ┌────────────────────────────────────────────────────────────────┐ │   │
│  │  │                    DownloadManager                              │ │   │
│  │  │  - downloadPDF(data)                                            │ │   │
│  │  │  - base64ToBlob(base64, mimeType)                              │ │   │
│  │  └────────────────────────────────────────────────────────────────┘ │   │
│  │                              │                                       │   │
│  └──────────────────────────────┼───────────────────────────────────────┘   │
│                                 │ ③                                         │
│                                 ▼                                           │
│                    ┌─────────────────────────┐                              │
│                    │   BROWSER DOWNLOADS API  │                              │
│                    │   (Save File Dialog)     │                              │
│                    └─────────────────────────┘                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

① browser.tabs.sendMessage() - Popup requests data from content script
② browser.runtime.sendMessage() - Popup sends PDF to background for download
③ browser.downloads.download() - Background triggers file save
```

## Execution Contexts

Firefox extensions run code in isolated contexts with different capabilities:

### 1. Content Script Context (`src/content/extractor.js`)

**Runs in**: The claude.ai web page
**Has access to**: Page DOM, limited extension APIs
**Cannot access**: Cross-origin resources, downloads API

```javascript
// Content scripts can:
document.querySelector('.some-element')  // ✓ Access page DOM
browser.runtime.sendMessage()            // ✓ Message other contexts

// Content scripts cannot:
browser.downloads.download()             // ✗ No downloads API
fetch('https://other-site.com')          // ✗ No cross-origin (usually)
```

### 2. Popup Context (`src/popup/`)

**Runs in**: Extension popup window
**Has access to**: Full extension APIs, own DOM
**Cannot access**: Page DOM directly

```javascript
// Popup can:
browser.tabs.sendMessage()    // ✓ Message content scripts
browser.runtime.sendMessage() // ✓ Message background script
new jsPDF()                   // ✓ Use bundled libraries

// Popup cannot:
document.querySelector('.page-element')  // ✗ Page DOM not accessible
```

### 3. Background Context (`src/background/background.js`)

**Runs in**: Persistent background process
**Has access to**: All extension APIs
**Cannot access**: Any DOM

```javascript
// Background can:
browser.downloads.download()  // ✓ Full downloads API
URL.createObjectURL()         // ✓ Create blob URLs

// Background cannot:
document.querySelector()      // ✗ No DOM exists here
```

## Data Flow Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           EXPORT WORKFLOW                                   │
└────────────────────────────────────────────────────────────────────────────┘

Step 1: User Initiates Export
─────────────────────────────
User clicks "Export as PDF" button in popup

                    ┌─────────────┐
                    │   popup.js  │
                    │             │
                    │ handleExport│
                    └──────┬──────┘
                           │
                           ▼
Step 2: Inject Content Script (if needed)
──────────────────────────────────────────
browser.tabs.executeScript(tabId, { file: 'src/content/extractor.js' })

                           │
                           ▼
Step 3: Request Conversation Data
─────────────────────────────────
browser.tabs.sendMessage(tabId, { action: 'extractConversation' })

        ┌──────────────────┴──────────────────┐
        │                                      │
        ▼                                      │
┌───────────────┐                              │
│ extractor.js  │                              │
│               │                              │
│ ChatExtractor │                              │
│   .extract()  │                              │
└───────┬───────┘                              │
        │                                      │
        │ Returns:                             │
        │ {                                    │
        │   title: "...",                      │
        │   messages: [...],                   │
        │   exportDate: "..."                  │
        │ }                                    │
        │                                      │
        └──────────────────┬───────────────────┘
                           │
                           ▼
Step 4: Generate PDF
────────────────────
PDFExporter.export(conversationData)

        ┌──────────────────┴──────────────────┐
        │                                      │
        ▼                                      │
┌─────────────────┐                            │
│ pdf-exporter.js │                            │
│                 │                            │
│  - Load jsPDF   │                            │
│  - Create doc   │                            │
│  - Render pages │                            │
│  - Return doc   │                            │
└────────┬────────┘                            │
         │                                     │
         │ Returns: jsPDF document object      │
         │                                     │
         └──────────────────┬──────────────────┘
                            │
                            ▼
Step 5: Convert to Base64
─────────────────────────
const pdfBase64 = doc.output('datauristring').split(',')[1]

                            │
                            ▼
Step 6: Send to Background for Download
───────────────────────────────────────
browser.runtime.sendMessage({
  action: 'downloadPDF',
  data: { content: pdfBase64, filename: '...' }
})

        ┌───────────────────┴──────────────────┐
        │                                       │
        ▼                                       │
┌─────────────────┐                             │
│ background.js   │                             │
│                 │                             │
│ DownloadManager │                             │
│  .downloadPDF() │                             │
│                 │                             │
│ 1. base64→Blob  │                             │
│ 2. Blob→URL     │                             │
│ 3. downloads.   │                             │
│    download()   │                             │
└────────┬────────┘                             │
         │                                      │
         │ Returns: downloadId                  │
         │                                      │
         └──────────────────┬───────────────────┘
                            │
                            ▼
Step 7: Browser Save Dialog
───────────────────────────
User selects save location → File saved
```

## Component Deep Dive

### ChatExtractor (`src/content/extractor.js`)

#### Purpose
Parses Claude.ai's DOM to extract conversation data while filtering out UI elements like the sidebar.

#### Challenge: Identifying the Chat Container

Claude.ai's layout includes a sidebar with chat history that uses similar styling to actual messages. The extractor must isolate only the active conversation.

```
┌─────────────────────────────────────────────────────────────────┐
│ Claude.ai Page Layout                                           │
├────────────────┬────────────────────────────────────────────────┤
│                │                                                │
│   SIDEBAR      │           MAIN CHAT AREA                       │
│                │                                                │
│ ┌────────────┐ │  ┌──────────────────────────────────────────┐ │
│ │ Chat 1     │ │  │  div.mx-auto.max-w-3xl                   │ │
│ │ Chat 2     │ │  │                                          │ │
│ │ Chat 3     │ │  │  ┌────────────────────────────────────┐  │ │
│ │ ...        │ │  │  │ User message [bg-bg-300]           │  │ │
│ │            │ │  │  └────────────────────────────────────┘  │ │
│ │ These also │ │  │                                          │ │
│ │ have       │ │  │  ┌────────────────────────────────────┐  │ │
│ │ bg-bg-300! │ │  │  │ Claude [.font-claude-response-body]│  │ │
│ │            │ │  │  └────────────────────────────────────┘  │ │
│ └────────────┘ │  │                                          │ │
│                │  └──────────────────────────────────────────┘ │
│                │                                                │
└────────────────┴────────────────────────────────────────────────┘
```

#### Solution: Multi-stage Container Detection

```javascript
findChatContainer() {
  // Stage 1: Try specific selectors for main chat area
  const selectors = [
    'div.mx-auto.max-w-3xl.flex-col',           // Exact match
    'div[class*="max-w-3xl"][class*="mx-auto"]', // Partial match
    '[data-testid="conversation-turn-list"]'     // Test ID if available
  ];

  // Stage 2: Validate container has Claude messages
  for (const selector of selectors) {
    const container = document.querySelector(selector);
    if (container?.querySelectorAll('.font-claude-response-body').length > 0) {
      return container;  // Found valid chat container
    }
  }

  // Stage 3: Fallback - find container with most Claude messages
  // that is NOT in sidebar
  return this.findContainerByContent();
}
```

#### Message Extraction Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    extractMessages(container)                    │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│ extractClaudeMessages() │     │ extractUserMessages()   │
│                         │     │                         │
│ Selector:               │     │ Selector:               │
│ .font-claude-response-  │     │ [class*="bg-bg-300"]    │
│  body                   │     │                         │
│                         │     │ Filters:                │
│ Process:                │     │ - Skip if in sidebar    │
│ 1. Find parent container│     │ - Skip if textarea      │
│ 2. Clone DOM            │     │ - Skip if link/button   │
│ 3. Convert code blocks  │     │ - Skip if too short     │
│ 4. Convert lists        │     │ - Remove avatar initials│
│ 5. Extract text         │     │                         │
└───────────┬─────────────┘     └───────────┬─────────────┘
            │                               │
            └───────────────┬───────────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │ Sort by DOM position  │
                │ (compareDocumentPosi- │
                │  tion)                │
                └───────────────────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │ Return messages array │
                └───────────────────────┘
```

### PDFExporter (`src/popup/pdf-exporter.js`)

#### Purpose
Transforms conversation data into a formatted PDF document.

#### PDF Coordinate System

```
┌─────────────────────────────────────────┐
│ (0,0)                                   │
│   ┌─────────────────────────────────┐   │
│   │ margin=15                       │   │
│   │   ┌─────────────────────────┐   │   │
│   │   │                         │   │   │
│   │   │    Content Area         │   │   │
│   │   │    (contentWidth)       │   │   │
│   │   │                         │   │   │
│   │   │    yPosition tracks     │   │   │
│   │   │    vertical position    │   │   │
│   │   │         │               │   │   │
│   │   │         ▼               │   │   │
│   │   │    ─────────────        │   │   │
│   │   │                         │   │   │
│   │   └─────────────────────────┘   │   │
│   │                                 │   │
│   └─────────────────────────────────┘   │
│                               (210,297) │  ← A4 dimensions in mm
└─────────────────────────────────────────┘

pageWidth = 210mm (A4)
pageHeight = 297mm (A4)
margin = 15mm
contentWidth = pageWidth - (2 × margin) = 180mm
```

#### Page Break Handling

```javascript
checkPageBreak(requiredHeight) {
  // Check if content would overflow page
  if (this.yPosition + requiredHeight > this.pageHeight - this.margin) {
    this.doc.addPage();        // Create new page
    this.yPosition = this.margin;  // Reset to top
    return true;               // Indicates page was added
  }
  return false;
}
```

#### Content Parsing Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    Message Content                               │
│                                                                 │
│ "Here's an example:                                             │
│                                                                 │
│ ```python                                                       │
│ print('hello')                                                  │
│ ```                                                             │
│                                                                 │
│ Key points:                                                     │
│ • First item                                                    │
│ • Second item"                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  parseContent() │
                    │                 │
                    │ Regex:          │
                    │ /```([^\n]*)\n  │
                    │ ([\s\S]*?)```/g │
                    └────────┬────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ { type: 'text'  │ │ { type: 'code'  │ │ { type: 'text'  │
│   content:      │ │   language:     │ │   content:      │
│   "Here's an    │ │   'python',     │ │   "Key points:  │
│    example:"    │ │   content:      │ │    • First...   │
│ }               │ │   "print..." }  │ │    • Second..." │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│renderTextPart() │ │renderCodeBlock()│ │renderTextPart() │
│                 │ │                 │ │ with list       │
│ Regular text    │ │ Gray background │ │ detection       │
│ rendering       │ │ Monospace font  │ │                 │
│                 │ │ Language label  │ │ parseListItem() │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

#### List Detection

```javascript
parseListItem(paragraph) {
  // Bullet points: •, -, *
  const bulletMatch = paragraph.match(/^(\s*)(•|-|\*)\s+(.*)$/);
  if (bulletMatch) {
    return {
      bulletChar: '•',
      text: bulletMatch[3],
      indent: margin + 8 + (bulletMatch[1].length * 2)
    };
  }

  // Numbered lists: 1., 2., etc.
  const numberedMatch = paragraph.match(/^(\s*)(\d+)\.\s+(.*)$/);
  if (numberedMatch) {
    return {
      bulletChar: `${numberedMatch[2]}.`,
      text: numberedMatch[3],
      indent: margin + 10 + (numberedMatch[1].length * 2)
    };
  }

  // Regular paragraph
  return { bulletChar: null, text: paragraph, indent: margin + 3 };
}
```

### DownloadManager (`src/background/background.js`)

#### Why Background Script for Downloads?

The popup context closes when the user clicks outside it. If we triggered downloads directly from the popup, the download might fail if the popup closes mid-process. The background script persists, ensuring reliable downloads.

```
┌────────────────────────────────────────────────────────────────┐
│                     Without Background Script                   │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Popup                                                         │
│  ┌──────────────┐                                              │
│  │ Generate PDF │                                              │
│  │      │       │                                              │
│  │      ▼       │    User clicks                               │
│  │ Start download ──────────────► Popup closes                 │
│  │      │       │                     │                        │
│  │      ▼       │                     ▼                        │
│  │   ✗ FAILS    │◄─────────────── Download interrupted         │
│  └──────────────┘                                              │
│                                                                │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                      With Background Script                     │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Popup                        Background                       │
│  ┌──────────────┐            ┌──────────────┐                  │
│  │ Generate PDF │            │              │                  │
│  │      │       │            │              │                  │
│  │      ▼       │   message  │              │                  │
│  │ Send base64  │───────────►│ Receive data │                  │
│  └──────────────┘            │      │       │                  │
│         │                    │      ▼       │                  │
│         │ (popup can close)  │ Create Blob  │                  │
│         ▼                    │      │       │                  │
│    ┌─────────┐               │      ▼       │                  │
│    │ Closed  │               │ Download API │                  │
│    └─────────┘               │      │       │                  │
│                              │      ▼       │                  │
│                              │  ✓ SUCCESS   │                  │
│                              └──────────────┘                  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## Error Handling

```
┌─────────────────────────────────────────────────────────────────┐
│                       Error Propagation                          │
└─────────────────────────────────────────────────────────────────┘

Content Script Errors
─────────────────────
extractor.js catches errors and returns:
{ success: false, error: "message" }

                    │
                    ▼

Popup Errors
────────────
popup.js checks response.success and shows status:
this.showStatus(`Error: ${error.message}`, 'error')

                    │
                    ▼

Background Errors
─────────────────
background.js catches and returns:
{ success: false, error: error.message }

                    │
                    ▼

User sees error message in popup status area
```

## Future Extension Points

### Adding JSON Export

```javascript
// 1. Create src/popup/json-exporter.js
const JSONExporter = {
  export(data) {
    return JSON.stringify(data, null, 2);
  }
};

// 2. Add button to popup.html
<button id="exportJSON">Export as JSON</button>

// 3. Add handler in popup.js
document.getElementById('exportJSON').addEventListener('click', () => {
  // ... extraction logic ...
  const json = JSONExporter.export(data);
  // ... download logic ...
});

// 4. Add text download handler in background.js
if (request.action === 'downloadText') {
  // Similar to downloadPDF but with text/plain mime type
}
```

### Supporting Other Chat Platforms

```javascript
// Create platform-specific extractors
// src/content/extractors/claude.js
// src/content/extractors/chatgpt.js

// Use strategy pattern in main extractor
const Extractor = {
  getStrategy() {
    if (location.host.includes('claude.ai')) {
      return ClaudeExtractor;
    } else if (location.host.includes('chat.openai.com')) {
      return ChatGPTExtractor;
    }
  }
};
```

## Testing Checklist

When making changes, verify:

- [ ] Extension loads without errors in `about:debugging`
- [ ] Popup opens and shows export button
- [ ] Extraction works on claude.ai conversation
- [ ] Sidebar content is NOT included
- [ ] User messages don't include avatar initials
- [ ] Code blocks render with language labels
- [ ] Bullet points and numbered lists are preserved
- [ ] PDF downloads successfully
- [ ] Long conversations handle page breaks correctly
