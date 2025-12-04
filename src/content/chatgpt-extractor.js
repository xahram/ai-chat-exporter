/**
 * ChatGPT Chat Extractor
 * Extracts conversation data from ChatGPT (chat.openai.com / chatgpt.com) interface
 */

const ChatGPTExtractor = {
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
      platform: 'chatgpt'
    };
  },

  /**
   * Checks if there are "Continue generating" or similar buttons indicating truncated content
   * @param {HTMLElement} container
   * @returns {boolean}
   */
  checkForHiddenContent(container) {
    if (!container) return false;

    const buttons = container.querySelectorAll('button');
    for (const button of buttons) {
      const text = button.textContent?.trim().toLowerCase();
      if (text === 'continue generating' || text === 'show more') {
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
    // ChatGPT uses various selectors for the main conversation area
    const selectors = [
      '[data-testid="conversation-turn-list"]',
      'main div[class*="react-scroll-to-bottom"]',
      'main div[class*="flex-col"][class*="items-center"]',
      'div[class*="flex-1"][class*="overflow"]',
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
    // Check for message elements using various ChatGPT selectors
    const messageSelectors = [
      '[data-message-author-role]',
      '[data-message-id]',
      'div[class*="agent-turn"]',
      'div[class*="user-turn"]'
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

    // Try multiple extraction strategies
    let extracted = this.extractByDataAttribute(container);

    if (extracted.length === 0) {
      extracted = this.extractByTurnStructure(container);
    }

    if (extracted.length === 0) {
      extracted = this.extractByGroupStructure(container);
    }

    return extracted;
  },

  /**
   * Extract messages using data-message-author-role attribute
   * @param {HTMLElement} container
   * @returns {Array}
   */
  extractByDataAttribute(container) {
    const messages = [];
    const messageElements = container.querySelectorAll('[data-message-author-role]');

    messageElements.forEach(element => {
      const role = element.getAttribute('data-message-author-role');
      if (role === 'user' || role === 'assistant') {
        const contentEl = element.querySelector('.markdown, .prose, [class*="markdown"]') || element;
        const text = this.extractFormattedText(contentEl);

        if (text && text.length > 5) {
          messages.push({
            role: role === 'user' ? 'user' : 'assistant',
            content: text,
            timestamp: new Date().toISOString()
          });
        }
      }
    });

    return messages;
  },

  /**
   * Extract messages by turn structure (agent-turn / user-turn classes)
   * @param {HTMLElement} container
   * @returns {Array}
   */
  extractByTurnStructure(container) {
    const messages = [];

    // Look for conversation turns
    const turns = container.querySelectorAll('[class*="group"][class*="text-token"]');

    turns.forEach(turn => {
      const isUser = turn.querySelector('[data-message-author-role="user"]') !== null ||
                     turn.classList.toString().includes('user');
      const isAssistant = turn.querySelector('[data-message-author-role="assistant"]') !== null ||
                          turn.classList.toString().includes('agent');

      if (!isUser && !isAssistant) {
        // Try to determine by structure - user messages typically have different styling
        const hasAvatar = turn.querySelector('img[alt*="User"], img[class*="avatar"]');
        if (hasAvatar) {
          // Could be either, check content structure
        }
      }

      const contentEl = turn.querySelector('.markdown, .prose, [class*="markdown"]') || turn;
      const text = this.extractFormattedText(contentEl);

      if (text && text.length > 5) {
        messages.push({
          role: isUser ? 'user' : 'assistant',
          content: text,
          timestamp: new Date().toISOString()
        });
      }
    });

    return messages;
  },

  /**
   * Extract messages by group structure
   * @param {HTMLElement} container
   * @returns {Array}
   */
  extractByGroupStructure(container) {
    const messages = [];

    // Find all message groups/blocks
    const groups = container.querySelectorAll('[class*="group"]');
    const processed = new Set();

    groups.forEach(group => {
      // Skip if already processed or is a child of processed element
      if (processed.has(group)) return;

      // Check for role indicators
      const roleAttr = group.querySelector('[data-message-author-role]');
      let role = roleAttr?.getAttribute('data-message-author-role');

      if (!role) {
        // Infer from class names or structure
        const classList = group.className || '';
        if (classList.includes('user') || group.querySelector('[class*="user"]')) {
          role = 'user';
        } else if (classList.includes('assistant') || classList.includes('agent')) {
          role = 'assistant';
        }
      }

      if (role === 'user' || role === 'assistant') {
        const contentEl = group.querySelector('.markdown, .prose, [class*="markdown"]') || group;
        const text = this.extractFormattedText(contentEl);

        if (text && text.length > 5 && !this.isDuplicate(messages, text)) {
          processed.add(group);
          messages.push({
            role: role,
            content: text,
            timestamp: new Date().toISOString()
          });
        }
      }
    });

    return messages;
  },

  /**
   * Check if message is duplicate
   * @param {Array} messages
   * @param {string} text
   * @returns {boolean}
   */
  isDuplicate(messages, text) {
    return messages.some(m => m.content === text);
  },

  /**
   * Extracts text content, handling syntax-highlighted spans
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

    // Remove copy buttons and other UI elements
    clone.querySelectorAll('button, [class*="copy"], [class*="toolbar"]').forEach(el => el.remove());

    // Handle code blocks
    clone.querySelectorAll('pre').forEach(pre => {
      const code = pre.querySelector('code');
      const text = code ? code.textContent : pre.textContent;
      // Try to get language from class
      const langClass = code?.className.match(/language-(\w+)/)?.[1] ||
                        pre.className.match(/language-(\w+)/)?.[1] || '';
      pre.replaceWith(document.createTextNode(`\n\`\`\`${langClass}\n${text}\n\`\`\`\n`));
    });

    // Handle tables - convert to markdown-style table format
    clone.querySelectorAll('table').forEach(table => {
      const rows = [];
      const headerRow = table.querySelector('thead tr');
      const bodyRows = table.querySelectorAll('tbody tr');

      // Extract header
      if (headerRow) {
        const headers = Array.from(headerRow.querySelectorAll('th, td'))
          .map(cell => this.getCleanText(cell).trim());
        rows.push('| ' + headers.join(' | ') + ' |');
        rows.push('| ' + headers.map(() => '---').join(' | ') + ' |');
      }

      // Extract body rows
      bodyRows.forEach(row => {
        const cells = Array.from(row.querySelectorAll('td, th'))
          .map(cell => this.getCleanText(cell).trim());
        rows.push('| ' + cells.join(' | ') + ' |');
      });

      // If no thead, try to get all rows
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

    // Get final text
    let text = clone.textContent || '';

    // Normalize whitespace
    text = text.split('\n').map(line => line.replace(/  +/g, ' ').trim()).join('\n');
    text = text.replace(/\n{3,}/g, '\n\n');

    return text.trim();
  },

  /**
   * Extracts conversation title
   * @returns {string}
   */
  extractTitle() {
    // ChatGPT title selectors
    const selectors = [
      'h1',
      '[data-testid="conversation-title"]',
      'nav a[class*="active"]',
      'nav li[class*="active"]',
      'title'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      let text = element?.textContent?.trim();

      // Skip generic titles
      if (text && text !== 'ChatGPT' && text !== 'New chat' && text.length > 2) {
        return text;
      }
    }

    // Try to get from page title
    const pageTitle = document.title;
    if (pageTitle && !pageTitle.includes('ChatGPT')) {
      return pageTitle;
    }

    return 'ChatGPT Conversation';
  }
};

// Message listener for popup communication
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractConversation') {
    try {
      const data = ChatGPTExtractor.extract();
      sendResponse({ success: true, data });
    } catch (error) {
      console.error('ChatGPT Extraction error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
  return true;
});
