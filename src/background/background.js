/**
 * Background Script
 * Handles file downloads from extension context
 */

const DownloadManager = {
  /**
   * Handles PDF download request
   * @param {Object} data - Contains base64 content and filename
   * @returns {Promise<number>} Download ID
   */
  async downloadPDF(data) {
    const { content, filename } = data;

    const blob = this.base64ToBlob(content, 'application/pdf');
    const url = URL.createObjectURL(blob);

    try {
      const downloadId = await browser.downloads.download({
        url,
        filename,
        saveAs: true,
        conflictAction: 'uniquify'
      });

      // Clean up blob URL after delay
      setTimeout(() => URL.revokeObjectURL(url), 60000);

      return downloadId;
    } catch (error) {
      URL.revokeObjectURL(url);
      throw error;
    }
  },

  /**
   * Converts base64 string to Blob
   * @param {string} base64
   * @param {string} mimeType
   * @returns {Blob}
   */
  base64ToBlob(base64, mimeType) {
    const bytes = atob(base64);
    const buffer = new Uint8Array(bytes.length);

    for (let i = 0; i < bytes.length; i++) {
      buffer[i] = bytes.charCodeAt(i);
    }

    return new Blob([buffer], { type: mimeType });
  }
};

// Message listener
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'downloadPDF') {
    DownloadManager.downloadPDF(request.data)
      .then(downloadId => sendResponse({ success: true, downloadId }))
      .catch(error => sendResponse({ success: false, error: error.message }));

    return true; // Keep channel open for async response
  }
});
