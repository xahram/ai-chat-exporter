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
      // Dingbats
      .replace(/[\u2700-\u27BF]/g, '')
      // Emojis
      .replace(/[\u{1F300}-\u{1F9FF}]/gu, '');

    // Final cleanup: ensure only printable ASCII and basic extended Latin
    // This is aggressive but ensures jsPDF compatibility
    result = result.split('').map(char => {
      const code = char.charCodeAt(0);
      // Allow: printable ASCII (32-126), newlines/tabs, and extended Latin (160-255)
      if ((code >= 32 && code <= 126) || code === 10 || code === 13 || code === 9 || (code >= 160 && code <= 255)) {
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
   * Loads jsPDF library dynamically
   */
  async loadLibrary() {
    if (window.jspdf) return;

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = browser.runtime.getURL('lib/jspdf.umd.min.js');
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  },

  /**
   * Initializes PDF document
   */
  initDocument() {
    const { jsPDF } = window.jspdf;
    this.doc = new jsPDF();
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
    this.contentWidth = this.pageWidth - 2 * this.margin;
    this.yPosition = this.margin;
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

      // Render text with wrapping
      const cleanText = text.replace(/`([^`]+)`/g, '$1');
      const availableWidth = bulletChar ? contentWidth - (indent - margin) - 3 : contentWidth - 6;
      const lines = doc.splitTextToSize(cleanText, availableWidth);

      lines.forEach((line, i) => {
        this.checkPageBreak(6);
        const xPos = i === 0 && bulletChar ? indent : (bulletChar ? indent : margin + 3);
        doc.text(line, xPos, this.yPosition);
        this.yPosition += 5;
      });
    });

    this.yPosition += 4;
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
