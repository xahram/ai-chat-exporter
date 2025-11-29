/**
 * Claude Chat Extractor
 * Extracts conversation data from Claude.ai chat interface
 */

const ChatExtractor = {
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
      hasHiddenContent
    };
  },

  /**
   * Checks if there are "Show more" buttons indicating truncated content
   * @param {HTMLElement} container
   * @returns {boolean}
   */
  checkForHiddenContent(container) {
    const buttons = container.querySelectorAll('button');
    for (const button of buttons) {
      const text = button.textContent?.trim().toLowerCase();
      if (text === 'show more') {
        return true;
      }
    }
    return false;
  },

  /**
   * Finds the main chat container, excluding sidebar
   * @returns {HTMLElement} The chat container element
   */
  findChatContainer() {
    const selectors = [
      'div.mx-auto.max-w-3xl.flex-col',
      'div[class*="max-w-3xl"][class*="mx-auto"][class*="flex-col"]',
      '[data-testid="conversation-turn-list"]',
      'main div[class*="max-w-3xl"]',
      'main div[class*="mx-auto"][class*="flex-col"]'
    ];

    for (const selector of selectors) {
      const containers = document.querySelectorAll(selector);
      for (const container of containers) {
        if (this.isValidChatContainer(container)) {
          return container;
        }
      }
    }

    return this.findContainerByContent() || document.body;
  },

  /**
   * Validates if container has Claude messages
   * @param {HTMLElement} container
   * @returns {boolean}
   */
  isValidChatContainer(container) {
    if (!container || container.offsetParent === null) return false;
    return container.querySelectorAll('.font-claude-response-body').length > 0;
  },

  /**
   * Fallback: find container by analyzing content
   * @returns {HTMLElement|null}
   */
  findContainerByContent() {
    const containers = document.querySelectorAll('div[class*="flex-col"]');
    let best = null;
    let maxMessages = 0;

    containers.forEach(container => {
      if (this.isInSidebar(container)) return;

      const count = container.querySelectorAll('.font-claude-response-body').length;
      if (count > maxMessages) {
        maxMessages = count;
        best = container;
      }
    });

    return maxMessages > 0 ? best : null;
  },

  /**
   * Checks if element is within sidebar
   * @param {HTMLElement} element
   * @returns {boolean}
   */
  isInSidebar(element) {
    const sidebarSelectors = [
      'nav', 'aside',
      '[class*="sidebar"]', '[class*="side-bar"]',
      '[class*="w-64"]', '[class*="w-72"]'
    ];
    return sidebarSelectors.some(sel => element.closest(sel));
  },

  /**
   * Extracts all messages from container
   * @param {HTMLElement} container
   * @returns {Array} Array of message objects
   */
  extractMessages(container) {
    const allMessages = [];

    this.extractClaudeMessages(container, allMessages);
    this.extractUserMessages(container, allMessages);

    // Sort by DOM position
    allMessages.sort((a, b) => {
      const pos = a.element.compareDocumentPosition(b.element);
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });

    return allMessages.map(msg => ({
      role: msg.role,
      content: msg.text,
      timestamp: new Date().toISOString()
    }));
  },

  /**
   * Extracts Claude's responses
   * @param {HTMLElement} container
   * @param {Array} messages
   */
  extractClaudeMessages(container, messages) {
    const processed = new Set();
    const bodies = container.querySelectorAll('.font-claude-response-body');

    bodies.forEach(body => {
      const msgContainer = this.findMessageContainer(body, container);
      if (processed.has(msgContainer)) return;
      processed.add(msgContainer);

      const text = this.extractFormattedText(msgContainer);
      if (text && text.length > 10) {
        messages.push({ role: 'assistant', text, element: body });
      }
    });
  },

  /**
   * Finds the parent message container
   * @param {HTMLElement} element
   * @param {HTMLElement} boundary
   * @returns {HTMLElement}
   */
  findMessageContainer(element, boundary) {
    let container = element.parentElement;

    while (container &&
           !container.classList.contains('standard-markdown') &&
           !container.classList.contains('grid')) {
      if (container === document.body || container === boundary) {
        return element.parentElement;
      }
      container = container.parentElement;
    }

    return container || element.parentElement;
  },

  /**
   * Extracts text content from an element, handling syntax-highlighted spans
   * Uses textContent to avoid spacing issues from styled span elements
   * @param {HTMLElement} element
   * @returns {string}
   */
  getCleanText(element) {
    // textContent doesn't add spaces between inline elements like innerText can
    return element.textContent || '';
  },

  /**
   * Extracts formatted text preserving code blocks and lists
   * @param {HTMLElement} element
   * @returns {string}
   */
  extractFormattedText(element) {
    const clone = element.cloneNode(true);

    // Handle code blocks - use textContent to avoid spacing from syntax highlighting spans
    clone.querySelectorAll('pre').forEach(pre => {
      const code = pre.querySelector('code');
      // textContent correctly concatenates text from nested spans without adding spaces
      const text = code ? code.textContent : pre.textContent;
      const lang = code?.className.match(/language-(\w+)/)?.[1] || '';
      pre.replaceWith(document.createTextNode(`\n\`\`\`${lang}\n${text}\n\`\`\`\n`));
    });

    // Handle unordered lists - use textContent for clean extraction
    clone.querySelectorAll('ul').forEach(ul => {
      const items = Array.from(ul.querySelectorAll('li'))
        .map(li => `• ${this.getCleanText(li).trim()}`)
        .join('\n');
      ul.replaceWith(document.createTextNode(`\n${items}\n`));
    });

    // Handle ordered lists - use textContent for clean extraction
    clone.querySelectorAll('ol').forEach(ol => {
      const items = Array.from(ol.querySelectorAll('li'))
        .map((li, i) => `${i + 1}. ${this.getCleanText(li).trim()}`)
        .join('\n');
      ol.replaceWith(document.createTextNode(`\n${items}\n`));
    });

    // Handle inline code - use textContent for syntax highlighted code
    clone.querySelectorAll('code').forEach(code => {
      if (!code.closest('pre')) {
        code.replaceWith(document.createTextNode(`\`${code.textContent}\``));
      }
    });

    // Use textContent for final extraction to avoid any remaining span spacing issues
    // Then normalize whitespace while preserving intentional line breaks
    let text = clone.textContent || '';

    // Normalize multiple spaces to single space (but preserve newlines)
    text = text.split('\n').map(line => line.replace(/  +/g, ' ').trim()).join('\n');

    // Remove excessive blank lines (more than 2 consecutive)
    text = text.replace(/\n{3,}/g, '\n\n');

    return text.trim();
  },

  /**
   * Extracts user messages
   * @param {HTMLElement} container
   * @param {Array} messages
   */
  extractUserMessages(container, messages) {
    const candidates = container.querySelectorAll('[class*="bg-bg-300"]');

    candidates.forEach(element => {
      if (this.shouldSkipUserElement(element)) return;

      let text = element.innerText?.trim();
      if (!text || text.length < 10) return;

      // Remove avatar initials from start
      text = this.cleanUserText(text);

      if (!messages.some(m => m.text === text)) {
        messages.push({ role: 'user', text, element });
      }
    });
  },

  /**
   * Determines if user element should be skipped
   * @param {HTMLElement} element
   * @returns {boolean}
   */
  shouldSkipUserElement(element) {
    // Skip input elements
    if (element.querySelector('textarea') || element.tagName === 'TEXTAREA') {
      return true;
    }

    // Skip form/input areas
    if (element.closest('form') || element.closest('[class*="input"]')) {
      return true;
    }

    // Skip sidebar elements
    if (this.isInSidebar(element) || element.closest('a[href*="/chat/"]')) {
      return true;
    }

    // Skip links/buttons (sidebar items)
    if (element.closest('a') || element.closest('button')) {
      return true;
    }

    return false;
  },

  /**
   * Cleans user text by removing avatar initials
   * @param {string} text
   * @returns {string}
   */
  cleanUserText(text) {
    const lines = text.split('\n').filter(l => l.trim());

    if (lines.length > 1) {
      const firstLine = lines[0].trim();
      // Check if first line is just initials (1-3 uppercase letters)
      if (firstLine.length <= 3 && /^[A-Z]{1,3}$/i.test(firstLine)) {
        return lines.slice(1).join('\n').trim();
      }
    }

    return text;
  },

  /**
   * Extracts conversation title
   * @returns {string}
   */
  extractTitle() {
    const selectors = [
      'h1',
      '[data-testid="conversation-title"]',
      '.conversation-title',
      'header h1',
      'header h2'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      const text = element?.textContent?.trim();
      if (text) return text;
    }

    return 'Claude Conversation';
  }
};

// Message listener for popup communication
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractConversation') {
    try {
      const data = ChatExtractor.extract();
      sendResponse({ success: true, data });
    } catch (error) {
      console.error('Extraction error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
  return true;
});
