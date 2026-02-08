/**
 * Gemini Chat Extractor
 * Extracts conversation data from Google Gemini (gemini.google.com) interface
 */

const GeminiExtractor = {
  /**
   * Main entry point - extracts conversation data from current page
   * @returns {Object} Conversation data with title, messages, export date, and warnings
   */
  extract() {
    const container = this.findChatContainer();
    const hasHiddenContent = this.checkForHiddenContent(container);
    const messages = this.extractMessages(container);

    return {
      title: this.extractTitle(),
      messages,
      exportDate: new Date().toISOString(),
      hasHiddenContent,
      platform: 'gemini'
    };
  },

  /**
   * Checks if there are collapsed/hidden content indicators
   * @param {HTMLElement} container
   * @returns {boolean}
   */
  checkForHiddenContent(container) {
    if (!container) return false;

    const buttons = container.querySelectorAll('button');
    for (const button of buttons) {
      const text = button.textContent?.trim().toLowerCase();
      if (text === 'show more' || text === 'continue generating') {
        return true;
      }
    }
    return false;
  },

  /**
   * Finds the main chat container
   * @returns {HTMLElement} The chat container element
   */
  findChatContainer() {
    const selectors = [
      '#chat-history',
      '.chat-history',
      'infinite-scroller.chat-history',
      '[data-test-id="chat-history-container"]',
      'main'
    ];

    for (const selector of selectors) {
      const container = document.querySelector(selector);
      if (container && this.hasMessages(container)) {
        return container;
      }
    }

    return document.body;
  },

  /**
   * Checks if container has chat messages
   * @param {HTMLElement} container
   * @returns {boolean}
   */
  hasMessages(container) {
    const messageSelectors = [
      '.conversation-container',
      'user-query',
      'model-response'
    ];

    for (const selector of messageSelectors) {
      if (container.querySelectorAll(selector).length > 0) {
        return true;
      }
    }
    return false;
  },

  /**
   * Extracts all messages from container
   * @param {HTMLElement} container
   * @returns {Array} Array of message objects
   */
  extractMessages(container) {
    const messages = [];

    const conversations = container.querySelectorAll('.conversation-container');

    conversations.forEach(conv => {
      const userQuery = conv.querySelector('user-query');
      if (userQuery) {
        const userText = this.extractUserMessage(userQuery);
        if (userText && userText.length > 0) {
          messages.push({
            role: 'user',
            content: userText,
            timestamp: new Date().toISOString()
          });
        }
      }

      const modelResponse = conv.querySelector('model-response');
      if (modelResponse) {
        const assistantText = this.extractAssistantMessage(modelResponse);
        if (assistantText && assistantText.length > 0) {
          messages.push({
            role: 'assistant',
            content: assistantText,
            timestamp: new Date().toISOString()
          });
        }
      }
    });

    return messages;
  },

  /**
   * Extracts user message text
   * @param {HTMLElement} userQuery
   * @returns {string}
   */
  extractUserMessage(userQuery) {
    const textEl = userQuery.querySelector('.query-text, .query-text-line');
    if (textEl) {
      return textEl.textContent?.trim() || '';
    }

    const contentEl = userQuery.querySelector('user-query-content');
    if (contentEl) {
      return contentEl.textContent?.trim() || '';
    }

    return '';
  },

  /**
   * Extracts assistant message with formatting
   * @param {HTMLElement} modelResponse
   * @returns {string}
   */
  extractAssistantMessage(modelResponse) {
    const markdownEl = modelResponse.querySelector('.markdown.markdown-main-panel, .markdown');
    if (markdownEl) {
      return this.extractFormattedText(markdownEl);
    }

    const contentEl = modelResponse.querySelector('message-content');
    if (contentEl) {
      return this.extractFormattedText(contentEl);
    }

    return '';
  },

  /**
   * Extracts text content
   * @param {HTMLElement} element
   * @returns {string}
   */
  getCleanText(element) {
    return element.textContent || '';
  },

  /**
   * Extracts formatted text preserving code blocks, lists, and tables
   * @param {HTMLElement} element
   * @returns {string}
   */
  extractFormattedText(element) {
    const clone = element.cloneNode(true);

    // Remove UI elements
    clone.querySelectorAll([
      'button',
      '[class*="copy"]',
      '[class*="toolbar"]',
      'source-footnote',
      'sources-carousel-inline',
      'source-inline-chip',
      '.source-inline-chip-container',
      'mat-icon',
      '.thoughts-container',
      'model-thoughts',
      '.avatar-gutter',
      'bard-avatar',
      '.table-footer',
      '.export-sheets-button'
    ].join(', ')).forEach(el => el.remove());

    // Handle KaTeX math equations - preserve raw LaTeX for PDF renderer
    clone.querySelectorAll('.katex').forEach(katex => {
      const annotation = katex.querySelector('annotation[encoding="application/x-tex"]');
      if (annotation) {
        const latex = annotation.textContent.trim();
        const isDisplay = katex.closest('.katex-display') !== null;
        const delimiter = isDisplay ? '$$' : '$';
        katex.replaceWith(document.createTextNode(`${delimiter}${latex}${delimiter}`));
      } else {
        const mathml = katex.querySelector('.katex-mathml');
        if (mathml) mathml.remove();
      }
    });

    // Handle code blocks
    clone.querySelectorAll('pre').forEach(pre => {
      const code = pre.querySelector('code');
      const text = code ? code.textContent : pre.textContent;
      const langClass = code?.className.match(/language-(\w+)/)?.[1] ||
                        pre.className.match(/language-(\w+)/)?.[1] || '';
      pre.replaceWith(document.createTextNode(`\n\`\`\`${langClass}\n${text}\n\`\`\`\n`));
    });

    // Handle tables
    clone.querySelectorAll('table').forEach(table => {
      const rows = [];
      const headerRow = table.querySelector('thead tr');
      const bodyRows = table.querySelectorAll('tbody tr');

      if (headerRow) {
        const headers = Array.from(headerRow.querySelectorAll('th, td'))
          .map(cell => this.getCleanText(cell).trim());
        rows.push('| ' + headers.join(' | ') + ' |');
        rows.push('| ' + headers.map(() => '---').join(' | ') + ' |');
      }

      bodyRows.forEach(row => {
        const cells = Array.from(row.querySelectorAll('td, th'))
          .map(cell => this.getCleanText(cell).trim());
        rows.push('| ' + cells.join(' | ') + ' |');
      });

      if (!headerRow && bodyRows.length === 0) {
        const allRows = table.querySelectorAll('tr');
        allRows.forEach((row, idx) => {
          const cells = Array.from(row.querySelectorAll('td, th'))
            .map(cell => this.getCleanText(cell).trim());
          rows.push('| ' + cells.join(' | ') + ' |');
          if (idx === 0) {
            rows.push('| ' + cells.map(() => '---').join(' | ') + ' |');
          }
        });
      }

      table.replaceWith(document.createTextNode('\n' + rows.join('\n') + '\n'));
    });

    // Handle unordered lists
    clone.querySelectorAll('ul').forEach(ul => {
      const items = Array.from(ul.querySelectorAll(':scope > li'))
        .map(li => `• ${this.getCleanText(li).trim()}`)
        .join('\n');
      ul.replaceWith(document.createTextNode(`\n${items}\n`));
    });

    // Handle ordered lists
    clone.querySelectorAll('ol').forEach(ol => {
      const items = Array.from(ol.querySelectorAll(':scope > li'))
        .map((li, i) => `${i + 1}. ${this.getCleanText(li).trim()}`)
        .join('\n');
      ol.replaceWith(document.createTextNode(`\n${items}\n`));
    });

    // Handle inline code
    clone.querySelectorAll('code').forEach(code => {
      if (!code.closest('pre')) {
        code.replaceWith(document.createTextNode(`\`${code.textContent}\``));
      }
    });

    // Handle horizontal rules
    clone.querySelectorAll('hr').forEach(hr => {
      hr.replaceWith(document.createTextNode('\n---\n'));
    });

    // Handle bold text
    clone.querySelectorAll('b, strong').forEach(bold => {
      bold.replaceWith(document.createTextNode(`**${bold.textContent}**`));
    });

    // Handle headers
    clone.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(header => {
      const level = parseInt(header.tagName[1]);
      const prefix = '#'.repeat(level) + ' ';
      header.replaceWith(document.createTextNode(`\n${prefix}${header.textContent}\n`));
    });

    let text = clone.textContent || '';

    text = text.split('\n').map(line => line.replace(/  +/g, ' ').trim()).join('\n');
    text = text.replace(/\n{3,}/g, '\n\n');

    return text.trim();
  },

  /**
   * Extracts conversation title
   * @returns {string}
   */
  extractTitle() {
    // Try .conversation-title first (Gemini's sidebar title)
    const conversationTitle = document.querySelector('.conversation-title');
    if (conversationTitle) {
      const text = conversationTitle.textContent?.trim();
      if (text && text !== 'Gemini' && text.length > 2) {
        return text;
      }
    }

    const selectors = [
      'h1',
      '[data-test-id="conversation-title"]',
      'title'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      let text = element?.textContent?.trim();

      if (text && text !== 'Gemini' && text !== 'Google Gemini' && text.length > 2) {
        if (selector === 'title') {
          text = text.replace(/ - Gemini$/, '').replace(/ - Google$/, '').trim();
        }
        if (text && text !== 'Gemini') {
          return text;
        }
      }
    }

    const firstQuery = document.querySelector('.query-text-line, .query-text');
    if (firstQuery) {
      let text = firstQuery.textContent?.trim() || '';
      if (text.length > 50) {
        text = text.substring(0, 50) + '...';
      }
      if (text) {
        return text;
      }
    }

    return 'Gemini Conversation';
  }
};

// Message listener for popup communication
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractConversation') {
    try {
      const data = GeminiExtractor.extract();
      sendResponse({ success: true, data });
    } catch (error) {
      console.error('Gemini Extraction error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
  return true;
});
