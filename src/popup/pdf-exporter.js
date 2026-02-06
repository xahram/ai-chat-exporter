/**
 * PDF Exporter
 * Generates PDF documents from Claude conversation data
 */

const PDFExporter = {
  doc: null,
  pageWidth: 0,
  pageHeight: 0,
  margin: 15,
  contentWidth: 0,
  yPosition: 0,
  platform: 'Claude', // Default platform name

  // Emoji codepoints included in our subset font
  SUBSET_EMOJIS: new Set([
    0x261D, 0x2615, 0x2699, 0x26A0, 0x26A1, 0x267B, 0x270B, 0x270C,
    0x2705, 0x2714, 0x2716, 0x2728, 0x274C, 0x2753, 0x2757, 0x2764,
    0x27A1, 0x2B05, 0x2B06, 0x2B07, 0x2B50,
    0x1F31F, 0x1F381, 0x1F389, 0x1F38A, 0x1F3AF, 0x1F3C6,
    0x1F44A, 0x1F44B, 0x1F44C, 0x1F44D, 0x1F44E, 0x1F44F,
    0x1F494, 0x1F499, 0x1F49A, 0x1F49B, 0x1F49C, 0x1F4A1,
    0x1F4A5, 0x1F4AA, 0x1F4AF, 0x1F4BB, 0x1F4CB, 0x1F4CC,
    0x1F4CE, 0x1F4D6, 0x1F4DA, 0x1F4DD, 0x1F4E7, 0x1F4F1,
    0x1F504, 0x1F50D, 0x1F511, 0x1F512, 0x1F513, 0x1F517,
    0x1F525, 0x1F527, 0x1F5A4, 0x1F600, 0x1F601, 0x1F602,
    0x1F603, 0x1F604, 0x1F605, 0x1F606, 0x1F609, 0x1F60A,
    0x1F60D, 0x1F60E, 0x1F60F, 0x1F610, 0x1F612, 0x1F614,
    0x1F615, 0x1F618, 0x1F61E, 0x1F620, 0x1F622, 0x1F62D,
    0x1F62E, 0x1F631, 0x1F633, 0x1F634, 0x1F642, 0x1F643,
    0x1F644, 0x1F64C, 0x1F64F, 0x1F680, 0x1F6AB, 0x1F6D1,
    0x1F91D, 0x1F91E, 0x1F914, 0x1F917, 0x1F923, 0x1F929,
    0x1F970, 0x1F973, 0x1F97A, 0x1F9E1,
  ]),

  /**
   * Checks if a character is in our emoji subset font
   * @param {string} char
   * @returns {boolean}
   */
  isSubsetEmoji(char) {
    if (!this.emojiFont) return false;
    return this.SUBSET_EMOJIS.has(char.codePointAt(0));
  },

  /**
   * Normalizes text for PDF compatibility
   * Removes problematic Unicode characters that cause spacing issues in jsPDF
   * @param {string} text
   * @returns {string}
   */
  normalizeText(text) {
    if (!text) return text;

    // jsPDF's default fonts have limited Unicode support
    // Characters outside basic Latin can cause spacing bugs where each char gets separated

    let result = text
      // Fix common quote variants
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'")
      .replace(/[…]/g, '...')
      .replace(/[–—]/g, '-')
      // Fix arrows that cause issues
      .replace(/→/g, '->')
      .replace(/←/g, '<-')
      .replace(/↔/g, '<->')
      .replace(/⇒/g, '=>')
      .replace(/⇐/g, '<=')
      // Fix other common symbols
      .replace(/•/g, '*')
      .replace(/·/g, '.')
      .replace(/×/g, 'x')
      .replace(/÷/g, '/')
      .replace(/≠/g, '!=')
      .replace(/≤/g, '<=')
      .replace(/≥/g, '>=')
      .replace(/≈/g, '~=')
      .replace(/±/g, '+/-')
      .replace(/∞/g, 'inf')
      // Remove zero-width characters (these are often the culprit!)
      .replace(/[\u200B-\u200F]/g, '')  // Zero-width spaces and direction marks
      .replace(/[\u2028-\u202F]/g, ' ') // Line/paragraph separators, narrow spaces
      .replace(/[\uFEFF]/g, '')         // BOM
      // Remove other invisible formatting characters
      .replace(/[\u00AD\u2060\u2061\u2062\u2063\u2064]/g, '')
      // Remove variation selectors (can cause rendering issues)
      .replace(/[\uFE00-\uFE0F]/g, '')
      // Remove combining marks that might cause issues
      .replace(/[\u0300-\u036F]/g, '')
      // General punctuation block (various special spaces)
      .replace(/[\u2000-\u200A]/g, ' ')
      // Remove word joiners and other invisible chars
      .replace(/[\u2060-\u206F]/g, '')
      // Dingbats (preserve subset: ✅✔✖☑☝✋✌➡ etc.)
      .replace(/[\u2700-\u27BF]/g, char => {
        return this.isSubsetEmoji(char) ? char : '';
      })
      // Emojis (preserve those in our subset font)
      .replace(/[\u{1F300}-\u{1F9FF}]/gu, char => {
        return this.isSubsetEmoji(char) ? char : '';
      });

    // Final cleanup: ensure only printable ASCII, extended Latin, and supported emojis
    // Use Array.from to correctly iterate over multi-byte emoji characters
    result = Array.from(result).map(char => {
      const code = char.codePointAt(0);
      // Allow: printable ASCII (32-126), newlines/tabs, and extended Latin (160-255)
      if ((code >= 32 && code <= 126) || code === 10 || code === 13 || code === 9 || (code >= 160 && code <= 255)) {
        return char;
      }
      // Allow supported emoji characters
      if (this.isSubsetEmoji(char)) {
        return char;
      }
      // Replace other chars with space or empty based on category
      return code < 32 ? '' : ' ';
    }).join('');

    // Clean up multiple spaces
    result = result.replace(/  +/g, ' ');

    return result;
  },

  /**
   * Exports conversation data to PDF
   * @param {Object} conversationData
   * @param {string} platform - Platform name (Claude or ChatGPT)
   * @returns {Promise<jsPDF>}
   */
  async export(conversationData, platform = 'Claude') {
    this.platform = platform;
    await this.loadLibrary();
    this.initDocument();
    this.renderHeader(conversationData);
    this.renderMessages(conversationData.messages);
    return this.doc;
  },

  /**
   * Loads jsPDF library and emoji font dynamically
   */
  async loadLibrary() {
    const loadScript = (src) => {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = browser.runtime.getURL(src);
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    };

    if (!window.jspdf) {
      await loadScript('lib/jspdf.umd.min.js');
    }
    if (!window.EMOJI_FONT_BASE64) {
      await loadScript('lib/emoji-font.js');
    }
  },

  /**
   * Initializes PDF document and registers emoji font
   */
  initDocument() {
    const { jsPDF } = window.jspdf;
    this.doc = new jsPDF();
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
    this.contentWidth = this.pageWidth - 2 * this.margin;
    this.yPosition = this.margin;

    // Register emoji font if available
    if (window.EMOJI_FONT_BASE64) {
      this.doc.addFileToVFS('NotoEmoji.ttf', window.EMOJI_FONT_BASE64);
      this.doc.addFont('NotoEmoji.ttf', 'NotoEmoji', 'normal');
      this.emojiFont = true;
    } else {
      this.emojiFont = false;
    }
  },

  /**
   * Checks and handles page breaks
   * @param {number} requiredHeight
   * @returns {boolean} True if page was added
   */
  checkPageBreak(requiredHeight) {
    if (this.yPosition + requiredHeight > this.pageHeight - this.margin) {
      this.doc.addPage();
      this.yPosition = this.margin;
      return true;
    }
    return false;
  },

  /**
   * Renders document header
   * @param {Object} data
   */
  renderHeader(data) {
    const { doc, margin, contentWidth } = this;

    // Title (normalized for Unicode compatibility)
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(50, 50, 50);
    this.renderWrappedText(this.normalizeText(data.title), margin, contentWidth, 8);

    // Export date
    this.yPosition += 3;
    doc.setFontSize(9);
    doc.setFont(undefined, 'italic');
    doc.setTextColor(120, 120, 120);
    doc.text(`Exported: ${new Date(data.exportDate).toLocaleString()}`, margin, this.yPosition);
    this.yPosition += 10;

    // Divider
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(margin, this.yPosition, this.pageWidth - margin, this.yPosition);
    this.yPosition += 10;
  },

  /**
   * Renders all messages
   * @param {Array} messages
   */
  renderMessages(messages) {
    messages.forEach(message => {
      this.renderMessage(message);
    });
  },

  /**
   * Renders a single message
   * @param {Object} message
   */
  renderMessage(message) {
    const isUser = message.role === 'user';

    this.checkPageBreak(20);
    this.renderMessageHeader(isUser);
    this.renderMessageContent(message.content, isUser);
    this.renderMessageSeparator();
  },

  /**
   * Renders message header (You/Assistant label)
   * @param {boolean} isUser
   */
  renderMessageHeader(isUser) {
    const { doc, margin, contentWidth, platform } = this;

    doc.setFont(undefined, 'bold');
    doc.setFontSize(11);
    // User: blue, Assistant: platform-specific color
    if (isUser) {
      doc.setFillColor(59, 130, 246); // Blue for user
    } else if (platform === 'ChatGPT') {
      doc.setFillColor(16, 163, 127); // Green for ChatGPT
    } else if (platform === 'Gemini') {
      doc.setFillColor(168, 127, 255); // Purple for Gemini (based on Gemini gradient)
    } else {
      doc.setFillColor(217, 119, 6); // Orange for Claude
    }
    doc.setTextColor(255, 255, 255);

    doc.roundedRect(margin, this.yPosition - 5, contentWidth, 10, 2, 2, 'F');
    doc.text(isUser ? 'You' : platform, margin + 5, this.yPosition + 1);
    this.yPosition += 12;
  },

  /**
   * Renders message content
   * @param {string} content
   * @param {boolean} isUser
   */
  renderMessageContent(content, isUser) {
    const { doc } = this;

    doc.setTextColor(30, 30, 30);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);

    // Normalize content to handle Unicode characters
    const normalizedContent = this.normalizeText(content);
    const parts = this.parseContent(normalizedContent);

    parts.forEach(part => {
      if (part.type === 'text') {
        this.renderTextPart(part.content);
      } else if (part.type === 'code') {
        this.renderCodeBlock(part);
      } else if (part.type === 'table') {
        this.renderTable(part.content);
      }
    });

    this.yPosition += 8;
  },

  /**
   * Parses content into text, code, and table parts
   * @param {string} content
   * @returns {Array}
   */
  parseContent(content) {
    const parts = [];
    // Match code blocks and tables
    const codeBlockRegex = /```([^\n]*)\n([\s\S]*?)```/g;
    const tableRegex = /(\|.+\|[\r\n]+\|[-:\s|]+\|[\r\n]+(?:\|.+\|[\r\n]*)+)/g;

    let lastIndex = 0;

    // First, find all code blocks and tables with their positions
    const blocks = [];

    let match;
    while ((match = codeBlockRegex.exec(content)) !== null) {
      blocks.push({
        type: 'code',
        start: match.index,
        end: match.index + match[0].length,
        language: match[1].trim() || 'code',
        content: match[2].trim()
      });
    }

    while ((match = tableRegex.exec(content)) !== null) {
      // Check if this table is inside a code block
      const isInsideCode = blocks.some(b => b.type === 'code' && match.index >= b.start && match.index < b.end);
      if (!isInsideCode) {
        blocks.push({
          type: 'table',
          start: match.index,
          end: match.index + match[0].length,
          content: match[1].trim()
        });
      }
    }

    // Sort by position
    blocks.sort((a, b) => a.start - b.start);

    // Build parts array
    blocks.forEach(block => {
      if (block.start > lastIndex) {
        const text = content.substring(lastIndex, block.start).trim();
        if (text) parts.push({ type: 'text', content: text });
      }

      if (block.type === 'code') {
        parts.push({
          type: 'code',
          language: block.language,
          content: block.content
        });
      } else if (block.type === 'table') {
        parts.push({
          type: 'table',
          content: block.content
        });
      }

      lastIndex = block.end;
    });

    if (lastIndex < content.length) {
      const text = content.substring(lastIndex).trim();
      if (text) parts.push({ type: 'text', content: text });
    }

    return parts.length ? parts : [{ type: 'text', content }];
  },

  /**
   * Renders a text part with list support
   * @param {string} content
   */
  renderTextPart(content) {
    const { doc, margin, contentWidth } = this;

    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    doc.setTextColor(30, 30, 30);

    const paragraphs = content.split('\n');

    paragraphs.forEach(paragraph => {
      if (!paragraph.trim()) {
        this.yPosition += 3;
        return;
      }

      const { bulletChar, text, indent } = this.parseListItem(paragraph);

      // Render bullet/number
      if (bulletChar) {
        this.checkPageBreak(6);
        doc.setFont(undefined, 'bold');
        doc.text(bulletChar, margin + 3, this.yPosition);
        doc.setFont(undefined, 'normal');
      }

      // Render text with wrapping and bold support
      const cleanText = text.replace(/`([^`]+)`/g, '$1');
      // Strip ** markers for width calculation so line-wrapping is accurate
      const textForWrapping = cleanText.replace(/\*\*(.+?)\*\*/g, '$1');
      const availableWidth = bulletChar ? contentWidth - (indent - margin) - 3 : contentWidth - 6;
      const lines = doc.splitTextToSize(textForWrapping, availableWidth);

      // Build a mapping: consume from the original text with markers to re-apply bold per line
      let remaining = cleanText;
      lines.forEach((line, i) => {
        this.checkPageBreak(6);
        const xPos = i === 0 && bulletChar ? indent : (bulletChar ? indent : margin + 3);

        // Find matching portion in the original text (with ** markers)
        const plainLineLen = line.length;
        let consumed = 0;
        let markedLine = '';
        let ri = 0;
        while (consumed < plainLineLen && ri < remaining.length) {
          if (remaining[ri] === '*' && remaining[ri + 1] === '*') {
            // Find closing **
            const closeIdx = remaining.indexOf('**', ri + 2);
            if (closeIdx !== -1) {
              const boldContent = remaining.substring(ri + 2, closeIdx);
              const canConsume = Math.min(boldContent.length, plainLineLen - consumed);
              markedLine += '**' + boldContent.substring(0, canConsume) + '**';
              consumed += canConsume;
              if (canConsume === boldContent.length) {
                ri = closeIdx + 2;
              } else {
                // Partial bold — adjust remaining for next line
                remaining = remaining.substring(0, ri + 2) + boldContent.substring(canConsume) + remaining.substring(closeIdx);
                ri = ri + 2 + canConsume + 2;
              }
            } else {
              markedLine += remaining[ri];
              consumed++;
              ri++;
            }
          } else {
            markedLine += remaining[ri];
            consumed++;
            ri++;
          }
        }
        remaining = remaining.substring(ri);

        const segments = this.parseBoldSegments(markedLine);
        this.renderFormattedLine(segments, xPos);
        this.yPosition += 5;
      });
    });

    this.yPosition += 4;
  },

  /**
   * Parses text into segments of normal and bold text
   * @param {string} text
   * @returns {Array<{text: string, bold: boolean}>}
   */
  parseBoldSegments(text) {
    const segments = [];
    const regex = /\*\*(.+?)\*\*/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ text: text.substring(lastIndex, match.index), bold: false });
      }
      segments.push({ text: match[1], bold: true });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      segments.push({ text: text.substring(lastIndex), bold: false });
    }

    return segments.length > 0 ? segments : [{ text, bold: false }];
  },

  /**
   * Splits text into runs of regular text and emoji characters
   * @param {string} text
   * @returns {Array<{text: string, isEmoji: boolean}>}
   */
  splitEmojiRuns(text) {
    if (!this.emojiFont) return [{ text, isEmoji: false }];

    const runs = [];
    let currentRun = '';
    let currentIsEmoji = false;

    for (const char of text) {
      const isEmoji = this.isSubsetEmoji(char);
      if (isEmoji !== currentIsEmoji && currentRun) {
        runs.push({ text: currentRun, isEmoji: currentIsEmoji });
        currentRun = '';
      }
      currentIsEmoji = isEmoji;
      currentRun += char;
    }
    if (currentRun) {
      runs.push({ text: currentRun, isEmoji: currentIsEmoji });
    }

    return runs;
  },

  /**
   * Renders a line with inline bold segments and emoji font switching
   * @param {Array<{text: string, bold: boolean}>} segments
   * @param {number} x - Starting x position
   */
  renderFormattedLine(segments, x) {
    const { doc } = this;
    let currentX = x;

    segments.forEach(segment => {
      if (!segment.text) return;

      const runs = this.splitEmojiRuns(segment.text);
      runs.forEach(run => {
        if (!run.text) return;
        if (run.isEmoji) {
          doc.setFont('NotoEmoji', 'normal');
        } else {
          doc.setFont('helvetica', segment.bold ? 'bold' : 'normal');
        }
        doc.text(run.text, currentX, this.yPosition);
        currentX += doc.getTextWidth(run.text);
      });
    });

    doc.setFont('helvetica', 'normal');
  },

  /**
   * Parses a line for list markers
   * @param {string} paragraph
   * @returns {Object}
   */
  parseListItem(paragraph) {
    const { margin } = this;

    // Bullet point
    const bulletMatch = paragraph.match(/^(\s*)(•|-|\*)\s+(.*)$/);
    if (bulletMatch) {
      const [, spaces, , text] = bulletMatch;
      return {
        bulletChar: '•',
        text,
        indent: margin + 8 + (spaces.length * 2)
      };
    }

    // Numbered list
    const numberedMatch = paragraph.match(/^(\s*)(\d+)\.\s+(.*)$/);
    if (numberedMatch) {
      const [, spaces, number, text] = numberedMatch;
      return {
        bulletChar: `${number}.`,
        text,
        indent: margin + 10 + (spaces.length * 2)
      };
    }

    return { bulletChar: null, text: paragraph, indent: margin + 3 };
  },

  /**
   * Renders a code block
   * @param {Object} part
   */
  renderCodeBlock(part) {
    const { doc, margin, contentWidth, pageHeight } = this;

    // Use Courier font for code - it's a built-in jsPDF font that handles ASCII well
    // Try to set courier, fall back to helvetica if not available
    try {
      doc.setFont('courier', 'normal');
    } catch {
      doc.setFont('helvetica', 'normal');
    }
    doc.setFontSize(8);

    const codeWidth = contentWidth - 10;
    const lines = [];

    // Normalize each line of code to handle any problematic characters
    part.content.split('\n').forEach(line => {
      if (!line) {
        lines.push('');
      } else {
        const normalizedLine = this.normalizeText(line);
        lines.push(...doc.splitTextToSize(normalizedLine, codeWidth));
      }
    });

    const lineHeight = 4;
    const blockHeight = Math.min(lines.length * lineHeight + 12, pageHeight - this.margin * 2);
    this.checkPageBreak(Math.min(blockHeight, 50));

    // Styling
    doc.setFillColor(245, 245, 245);
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);

    // Language label
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text((part.language || 'CODE').toUpperCase(), margin + 4, this.yPosition + 2);
    this.yPosition += 8;

    // Code content
    doc.setFontSize(8);
    doc.setTextColor(40, 40, 40);

    lines.forEach(line => {
      if (this.checkPageBreak(lineHeight + 2)) {
        try {
          doc.setFont('courier', 'normal');
        } catch {
          doc.setFont('helvetica', 'normal');
        }
        doc.setFontSize(8);
        doc.setTextColor(40, 40, 40);
      }
      doc.text(line || ' ', margin + 5, this.yPosition);
      this.yPosition += lineHeight;
    });

    this.yPosition += 6;
    doc.setFont('helvetica', 'normal');
    doc.setLineWidth(0.2);
  },

  /**
   * Renders a markdown-style table
   * @param {string} tableContent - Markdown table string
   */
  renderTable(tableContent) {
    const { doc, margin, contentWidth } = this;

    // Parse the markdown table
    const lines = tableContent.split('\n').filter(line => line.trim());
    if (lines.length < 2) return;

    // Parse rows
    const rows = [];
    lines.forEach((line, idx) => {
      // Skip separator row (contains only dashes and pipes)
      if (/^\|[\s-:|]+\|$/.test(line)) return;

      const cells = line.split('|')
        .filter((_, i, arr) => i > 0 && i < arr.length - 1) // Remove empty first/last from split
        .map(cell => cell.trim());

      if (cells.length > 0) {
        rows.push(cells);
      }
    });

    if (rows.length === 0) return;

    // Calculate column widths
    const numCols = Math.max(...rows.map(r => r.length));
    const colWidth = (contentWidth - 10) / numCols;
    const rowHeight = 7;
    const tableStartY = this.yPosition;

    // Check if we need a page break for at least header + 1 row
    this.checkPageBreak(rowHeight * 2 + 10);

    doc.setFontSize(9);
    doc.setLineWidth(0.3);

    rows.forEach((row, rowIdx) => {
      // Check for page break
      if (this.checkPageBreak(rowHeight + 2)) {
        doc.setFontSize(9);
      }

      const rowY = this.yPosition;

      // Draw row background (header gets different color)
      if (rowIdx === 0) {
        doc.setFillColor(240, 240, 240);
        doc.rect(margin + 3, rowY - 5, contentWidth - 6, rowHeight, 'F');
        doc.setFont(undefined, 'bold');
      } else {
        doc.setFont(undefined, 'normal');
      }

      // Draw cells
      doc.setTextColor(30, 30, 30);
      row.forEach((cell, colIdx) => {
        const cellX = margin + 5 + (colIdx * colWidth);
        const cellText = doc.splitTextToSize(cell, colWidth - 4)[0] || ''; // Truncate if needed
        doc.text(cellText, cellX, rowY);
      });

      // Draw horizontal line
      doc.setDrawColor(200, 200, 200);
      doc.line(margin + 3, rowY + 2, margin + contentWidth - 3, rowY + 2);

      this.yPosition += rowHeight;
    });

    // Draw outer border
    doc.setDrawColor(180, 180, 180);
    const tableHeight = this.yPosition - tableStartY;
    doc.rect(margin + 3, tableStartY - 5, contentWidth - 6, tableHeight + 2);

    this.yPosition += 6;
    doc.setFont('helvetica', 'normal');
  },

  /**
   * Renders separator between messages
   */
  renderMessageSeparator() {
    const { doc, margin, pageWidth, pageHeight } = this;

    if (this.yPosition < pageHeight - margin - 5) {
      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.3);
      doc.line(margin + 10, this.yPosition - 4, pageWidth - margin - 10, this.yPosition - 4);
    }
  },

  /**
   * Renders wrapped text
   * @param {string} text
   * @param {number} x
   * @param {number} maxWidth
   * @param {number} lineHeight
   */
  renderWrappedText(text, x, maxWidth, lineHeight = 5) {
    const lines = this.doc.splitTextToSize(text, maxWidth);
    lines.forEach(line => {
      this.checkPageBreak(lineHeight);
      this.doc.text(line, x, this.yPosition);
      this.yPosition += lineHeight;
    });
  }
};
