# Plan: User-Configurable PDF Settings (Persistent)

## Problem

All PDF styling is hardcoded — header colors, font sizes, display names ("You", "Claude", etc.) are baked into the code. Users can't customize the look of their exported PDFs.

## Goal

Add a settings panel (gear icon in popup) where users configure their preferences **once**. Settings persist across browser sessions via `browser.storage.local` — no need to reconfigure every time.

---

## User-Facing Settings (~8 options)

| Setting | Default | What it controls |
|---------|---------|-----------------|
| Your display name | "You" | Label on user message headers in PDF |
| LLM display name | "Claude" / "ChatGPT" / "Gemini" | Label on assistant message headers (per-platform or single override) |
| Your header color | Blue `#3B82F6` | Background color of user message header bar |
| Claude header color | Orange `#D97706` | Background color of Claude message header bar |
| ChatGPT header color | Green `#10A37F` | Background color of ChatGPT message header bar |
| Gemini header color | Purple `#A87FFF` | Background color of Gemini message header bar |
| Content font size | 10pt | Font size of message body text |
| Header font size | 11pt | Font size of role label in header bar |

---

## UI Flow

```
┌─────────────────────────┐
│  AI Chat Exporter  [⚙]  │  ← gear icon in top-right of header
│                         │
│  [Export as PDF]        │  ← main view (existing)
│                         │
│  v1.2.1                 │
└─────────────────────────┘
        │
        │ click ⚙
        ▼
┌─────────────────────────┐
│  [←] Settings           │  ← back button returns to main view
│                         │
│  Your display name      │
│  [___You___________]    │  ← text input
│                         │
│  LLM display name       │
│  [_______________]      │  ← text input (blank = use platform default)
│                         │
│  Your header color      │
│  [#3B82F6] [■]          │  ← color input
│                         │
│  Claude header color    │
│  [#D97706] [■]          │
│                         │
│  ChatGPT header color   │
│  [#10A37F] [■]          │
│                         │
│  Gemini header color    │
│  [#A87FFF] [■]          │
│                         │
│  Content font size      │
│  [10] pt                │  ← number input
│                         │
│  Header font size       │
│  [11] pt                │  ← number input
│                         │
│  [Reset to Defaults]    │  ← resets all to original values
└─────────────────────────┘
```

- Main view and settings view are **two panels in the same popup** — toggled by showing/hiding
- **Back button [←]** returns to the main export view
- Settings auto-save on change (no explicit save button needed)
- Blank LLM display name = use platform default ("Claude", "ChatGPT", "Gemini")

---

## Changes

### 1. Add `storage` permission

**File**: `manifest.json`
**What**: Add `"storage"` to the permissions array (line 19)

Required for `browser.storage.local.get()` / `browser.storage.local.set()` to persist settings.

### 2. Add settings panel HTML

**File**: `src/popup/popup.html`
**What**:
- Add a gear icon button `⚙` in the header (top-right)
- Add a new `<div id="settingsPanel">` section (hidden by default) with:
  - Back button `[←] Settings`
  - Input fields for each setting (text, color, number inputs)
  - Reset to defaults button
- The existing main content gets wrapped in a `<div id="mainPanel">`

### 3. Add settings panel styling

**File**: `src/popup/popup.css`
**What**: Styles for:
- Gear icon button (positioned in header, subtle, no background)
- Settings panel layout (same width as popup, form-like)
- Back button styling
- Input fields (text, color picker, number)
- Reset button
- Panel show/hide transitions
- Matches existing design language (colors, spacing, rounded corners)

### 4. Add settings logic to popup controller

**File**: `src/popup/popup.js`
**What**:
- Define `DEFAULT_SETTINGS` constant with all default values
- On `init()`: load settings from `browser.storage.local.get('settings')`
- `showSettings()` / `hideSettings()`: toggle between main and settings panels
- Auto-save: each input gets a `change` event listener → `browser.storage.local.set()`
- `resetDefaults()`: restore all inputs to defaults and save
- Pass loaded settings to `PDFExporter.export()` as a parameter

### 5. Apply settings in PDF exporter

**File**: `src/popup/pdf-exporter.js`
**What**:
- `export()` method accepts an optional `settings` parameter
- Replace hardcoded values with `settings.xxx || DEFAULT` fallbacks:
  - Line 205: user header color → `settings.userHeaderColor`
  - Line 207: ChatGPT color → `settings.chatgptHeaderColor`
  - Line 209: Gemini color → `settings.geminiHeaderColor`
  - Line 211: Claude color → `settings.claudeHeaderColor`
  - Line 216: "You" label → `settings.userDisplayName`
  - Line 216: platform label → `settings.llmDisplayName || platform`
  - Line 202: header font size → `settings.headerFontSize`
  - Line 230: content font size → `settings.contentFontSize`
- Every setting has a hardcoded fallback so the extension works identically if no settings are saved

---

## Files NOT modified

| File | Reason |
|------|--------|
| `claude-extractor.js` | Extraction logic unchanged |
| `chatgpt-extractor.js` | Extraction logic unchanged |
| `gemini-extractor.js` | Extraction logic unchanged |
| `background.js` | Download logic unchanged |

---

## Data Structure

```js
// Stored in browser.storage.local under key "settings"
{
  userDisplayName: "You",           // string
  llmDisplayName: "",               // string, blank = use platform default
  userHeaderColor: "#3B82F6",       // hex color
  claudeHeaderColor: "#D97706",     // hex color
  chatgptHeaderColor: "#10A37F",    // hex color
  geminiHeaderColor: "#A87FFF",     // hex color
  contentFontSize: 10,              // number (pt)
  headerFontSize: 11                // number (pt)
}
```

---

## Persistence Behavior

- **First install**: No settings saved → all defaults apply → extension works exactly as today
- **User opens settings**: Inputs pre-filled with current values (defaults or saved)
- **User changes a value**: Saved immediately to `browser.storage.local`
- **Next export**: Settings loaded in `init()` and passed to PDF exporter
- **Browser restart**: Settings persist (storage.local survives sessions)
- **Extension update**: Settings persist (storage.local survives updates)
- **Reset button**: Clears saved settings → reverts to defaults

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| No settings saved (fresh install) | Every value has a hardcoded default fallback — zero behavior change |
| Invalid color value | HTML `<input type="color">` enforces valid hex |
| Extreme font size | Number input has `min`/`max` constraints (6-16pt) |
| Storage API unavailable | Fallback to defaults — `try/catch` around storage calls |
| Popup width too narrow for settings | Settings panel uses same 280px width, labels stacked above inputs |

---

## Verification

1. Fresh install → export PDF → looks identical to current output
2. Open settings → change "You" to "Me" → export → header says "Me"
3. Change user header color to red → export → user headers are red
4. Set LLM display name to "AI" → export → all assistant headers say "AI"
5. Clear LLM display name → export → headers use platform defaults again
6. Change font size → export → text size changes
7. Click Reset to Defaults → export → back to original look
8. Close browser → reopen → settings still applied
9. Back button returns to main export view
