# Plan: Add Emoji Support & Bold Text Rendering in PDF Export

## Problem

1. **Emojis disappear** — `normalizeText()` in `pdf-exporter.js` strips all emoji characters silently
2. **Bold text is lost** — Claude and ChatGPT extractors discard `<b>`/`<strong>` tags during DOM extraction

## Guiding Principle

**No existing behavior should break.** All changes are additive — we're enhancing what gets preserved, not changing how the existing pipeline works. The popup UI, export flow, file naming, page layout, code blocks, tables, and lists all remain untouched.

---

## Changes

### 1. Claude extractor — preserve bold tags

**File**: `src/content/claude-extractor.js`
**Where**: After inline code handling (line 228), before `textContent` call (line 232)
**What**: Convert `<b>` and `<strong>` elements to `**markdown**` before they're lost

```js
// Handle bold/strong text
clone.querySelectorAll('b, strong').forEach(bold => {
  if (!bold.closest('pre')) {
    bold.replaceWith(document.createTextNode(`**${bold.textContent}**`));
  }
});
```

**Why this is safe**: This mirrors exactly what the Gemini extractor already does at lines 264-267. The `pre` check ensures code blocks are untouched. Text without bold tags is completely unaffected.

---

### 2. ChatGPT extractor — preserve bold tags

**File**: `src/content/chatgpt-extractor.js`
**Where**: After inline code handling (line 325), before `textContent` call (line 328)
**What**: Same code block as above

**Why this is safe**: Identical logic, identical placement. Only adds handling for tags that were previously ignored.

---

### 3. PDF exporter — render bold segments and convert emojis

**File**: `src/popup/pdf-exporter.js`

#### 3a. Emoji handling in `normalizeText()` (lines 64-67)

**Before**: Emojis are silently stripped
**After**: Common emojis → readable text like `[thumbs up]`, unknown emojis → `[emoji]`

- Add a const `EMOJI_MAP` (~100 common entries) at the top of the file
- Replace the emoji regex on line 67 with a map lookup + fallback
- The ASCII filter on lines 71-79 stays exactly as-is (the replacement text is pure ASCII so it passes through)

**What stays the same**: All other character replacements (smart quotes, dashes, arrows, zero-width chars) — untouched.

#### 3b. New method: `parseBoldSegments(line)`

Splits a string like `"hello **world** foo"` into:

```js
[
  { text: "hello ", bold: false },
  { text: "world", bold: true },
  { text: " foo", bold: false }
]
```

If there are no `**` markers, returns the whole string as a single non-bold segment — **existing behavior preserved**.

#### 3c. Refactor `renderTextPart()` inner loop (lines 357-361)

**Before**: `doc.text(line, xPos, this.yPosition)` — renders whole line as plain text
**After**: Parse line for bold segments, render each segment with appropriate font, advance x position

- Strip `**` markers before `splitTextToSize()` so line-wrapping width is accurate
- After wrapping, re-parse each line for bold segments and render segment-by-segment
- Lines without any `**` markers render exactly as before (single segment, normal font)

**What stays the same**: Page break logic, list/bullet rendering, indentation, spacing, code block rendering, table rendering — all untouched.

---

## Files NOT modified

| File | Reason |
|------|--------|
| `gemini-extractor.js` | Already handles bold at lines 264-267 |
| `popup.html` | No new scripts or UI changes |
| `popup.css` | No styling changes |
| `popup.js` | Export flow unchanged |
| `background.js` | Download logic unchanged |
| `manifest.json` | No new permissions needed |

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| `**` in code blocks treated as bold | Code blocks are extracted as markdown BEFORE bold handling; `parseBoldSegments` only runs on text parts, not code parts |
| Python `**` operator misread as bold | Only occurs outside code blocks (very rare); the regex uses non-greedy `(.+?)` so `2 ** 3` won't match (no closing `**` pair) |
| Bold spanning word-wrap boundary | Graceful degradation — unmatched `**` on a wrapped line renders as plain text with the `**` chars stripped |
| Emoji map missing an emoji | Falls back to `[emoji]` instead of silent removal — strictly better than current behavior |
| Existing PDFs look different | Only conversations WITH bold/emoji will differ — and they'll be MORE accurate, not less |

---

## Verification

1. Load extension in Firefox via `about:debugging`
2. Export a **ChatGPT** conversation with bold text → bold renders in PDF
3. Export a **Claude** conversation with bold text → bold renders in PDF
4. Export a **Gemini** conversation → unchanged behavior (already worked)
5. Export a conversation with emojis → `[thumbs up]` etc. instead of blank
6. Export a conversation with code blocks containing `**` → no false bold
7. Export a plain conversation (no bold, no emoji) → identical output to before
