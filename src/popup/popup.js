/**
 * Popup Controller
 * Handles UI interactions and export workflow
 */

const PopupController = {
  statusEl: null,

  /**
   * Initializes the popup
   */
  init() {
    this.statusEl = document.getElementById('status');
    this.bindEvents();
  },

  /**
   * Binds click events
   */
  bindEvents() {
    document.getElementById('exportPDF').addEventListener('click', () => {
      this.handleExport();
    });

    document.getElementById('confirmExport').addEventListener('click', () => {
      this.confirmExport();
    });

    document.getElementById('cancelExport').addEventListener('click', () => {
      this.cancelExport();
    });
  },

  pendingExportData: null,

  /**
   * Handles the export process
   */
  async handleExport() {
    try {
      this.showStatus('Extracting conversation...', 'info');

      const tab = await this.getActiveTab();

      if (!this.isSupportedPage(tab)) {
        this.showStatus('Please open a Claude.ai or ChatGPT conversation', 'error');
        return;
      }

      // Store current platform for filename generation
      this.currentPlatform = this.getPlatformName(tab);

      await this.injectContentScript(tab);
      const data = await this.extractConversation(tab.id);

      if (!data || data.messages.length === 0) {
        this.showStatus('No messages found in conversation', 'error');
        return;
      }

      // Check for hidden content ("Show more" buttons)
      if (data.hasHiddenContent) {
        this.pendingExportData = data;
        this.showWarning();
        return;
      }

      await this.exportToPDF(data);

    } catch (error) {
      console.error('Export error:', error);
      this.showStatus(`Error: ${error.message}`, 'error');
    }
  },

  /**
   * Shows warning about hidden content
   */
  showWarning() {
    const warningEl = document.getElementById('warning');
    warningEl.classList.add('show');
    this.hideStatus();
  },

  /**
   * Hides warning dialog
   */
  hideWarning() {
    const warningEl = document.getElementById('warning');
    warningEl.classList.remove('show');
  },

  /**
   * Handles user confirming export despite hidden content
   */
  async confirmExport() {
    this.hideWarning();
    if (this.pendingExportData) {
      try {
        await this.exportToPDF(this.pendingExportData);
      } catch (error) {
        console.error('Export error:', error);
        this.showStatus(`Error: ${error.message}`, 'error');
      }
      this.pendingExportData = null;
    }
  },

  /**
   * Handles user canceling export
   */
  cancelExport() {
    this.hideWarning();
    this.pendingExportData = null;
    this.showStatus('Export cancelled', 'info');
    setTimeout(() => this.hideStatus(), 2000);
  },

  /**
   * Gets the active tab
   * @returns {Promise<Object>}
   */
  async getActiveTab() {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    return tabs[0];
  },

  /**
   * Checks if tab is on Claude.ai
   * @param {Object} tab
   * @returns {boolean}
   */
  isClaudePage(tab) {
    return tab.url?.includes('claude.ai');
  },

  /**
   * Checks if tab is on ChatGPT
   * @param {Object} tab
   * @returns {boolean}
   */
  isChatGPTPage(tab) {
    return tab.url?.includes('chat.openai.com') || tab.url?.includes('chatgpt.com');
  },

  /**
   * Checks if tab is on a supported chat platform
   * @param {Object} tab
   * @returns {boolean}
   */
  isSupportedPage(tab) {
    return this.isClaudePage(tab) || this.isChatGPTPage(tab);
  },

  /**
   * Gets the platform name for display
   * @param {Object} tab
   * @returns {string}
   */
  getPlatformName(tab) {
    if (this.isClaudePage(tab)) return 'Claude';
    if (this.isChatGPTPage(tab)) return 'ChatGPT';
    return 'Unknown';
  },

  /**
   * Gets the content script file for the current platform
   * @param {Object} tab
   * @returns {string}
   */
  getContentScriptFile(tab) {
    if (this.isClaudePage(tab)) return 'src/content/extractor.js';
    if (this.isChatGPTPage(tab)) return 'src/content/chatgpt-extractor.js';
    return null;
  },

  /**
   * Injects content script if needed
   * @param {Object} tab - The tab object
   */
  async injectContentScript(tab) {
    const scriptFile = this.getContentScriptFile(tab);
    if (!scriptFile) {
      throw new Error('Unsupported platform');
    }

    try {
      await browser.tabs.executeScript(tab.id, {
        file: scriptFile
      });
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (e) {
      // Script may already be loaded
      console.log('Content script status:', e.message);
    }
  },

  /**
   * Extracts conversation from page
   * @param {number} tabId
   * @returns {Promise<Object>}
   */
  async extractConversation(tabId) {
    const response = await browser.tabs.sendMessage(tabId, {
      action: 'extractConversation'
    });

    if (!response.success || !response.data) {
      throw new Error('Failed to extract conversation');
    }

    return response.data;
  },

  /**
   * Exports data to PDF
   * @param {Object} data
   */
  async exportToPDF(data) {
    this.showStatus('Generating PDF...', 'info');

    const doc = await PDFExporter.export(data, this.currentPlatform);
    const filename = this.generateFilename(data.title);
    const pdfBase64 = doc.output('datauristring').split(',')[1];

    const response = await browser.runtime.sendMessage({
      action: 'downloadPDF',
      data: { content: pdfBase64, filename }
    });

    if (!response.success) {
      throw new Error(response.error || 'Download failed');
    }

    this.showStatus('PDF exported successfully!', 'success');
    setTimeout(() => this.hideStatus(), 3000);
  },

  /**
   * Generates safe filename
   * @param {string} title
   * @returns {string}
   */
  generateFilename(title) {
    const safeTitle = title
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase()
      .substring(0, 50);
    const date = new Date().toISOString().split('T')[0];
    const platform = (this.currentPlatform || 'chat').toLowerCase();
    return `${platform}_chat_${safeTitle}_${date}.pdf`;
  },

  /**
   * Shows status message
   * @param {string} message
   * @param {string} type - 'info', 'success', or 'error'
   */
  showStatus(message, type) {
    this.statusEl.textContent = message;
    this.statusEl.className = `status show ${type}`;
  },

  /**
   * Hides status message
   */
  hideStatus() {
    this.statusEl.className = 'status';
  }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  PopupController.init();
});
