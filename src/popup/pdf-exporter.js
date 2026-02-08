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

  // Map original emoji codepoints to PUA codepoints used in our subset font.
  // jsPDF can't handle codepoints above U+FFFF, so the font remaps all emojis
  // to the Private Use Area (U+E000+) where jsPDF can render them.
  // 335 emoji, PUA range E000-E14E
  EMOJI_TO_PUA: new Map([
    [0x231A, 0xE000], [0x231B, 0xE001], [0x2328, 0xE002], [0x23E9, 0xE003],
    [0x23EA, 0xE004], [0x23EB, 0xE005], [0x23EC, 0xE006], [0x23F0, 0xE007],
    [0x23F3, 0xE008], [0x2600, 0xE009], [0x2601, 0xE00A], [0x2602, 0xE00B],
    [0x2603, 0xE00C], [0x2604, 0xE00D], [0x2611, 0xE00E], [0x2614, 0xE00F],
    [0x2615, 0xE010], [0x2618, 0xE011], [0x261D, 0xE012], [0x2620, 0xE013],
    [0x2622, 0xE014], [0x2623, 0xE015], [0x2626, 0xE016], [0x262A, 0xE017],
    [0x262E, 0xE018], [0x262F, 0xE019], [0x2638, 0xE01A], [0x2639, 0xE01B],
    [0x263A, 0xE01C], [0x2640, 0xE01D], [0x2642, 0xE01E], [0x2648, 0xE01F],
    [0x2649, 0xE020], [0x264A, 0xE021], [0x264B, 0xE022], [0x264C, 0xE023],
    [0x264D, 0xE024], [0x264E, 0xE025], [0x264F, 0xE026], [0x2650, 0xE027],
    [0x2651, 0xE028], [0x2652, 0xE029], [0x2653, 0xE02A], [0x265F, 0xE02B],
    [0x2660, 0xE02C], [0x2663, 0xE02D], [0x2665, 0xE02E], [0x2666, 0xE02F],
    [0x2668, 0xE030], [0x267B, 0xE031], [0x267E, 0xE032], [0x267F, 0xE033],
    [0x2692, 0xE034], [0x2693, 0xE035], [0x2694, 0xE036], [0x2695, 0xE037],
    [0x2696, 0xE038], [0x2697, 0xE039], [0x2699, 0xE03A], [0x269B, 0xE03B],
    [0x269C, 0xE03C], [0x26A0, 0xE03D], [0x26A1, 0xE03E], [0x26AA, 0xE03F],
    [0x26AB, 0xE040], [0x26B0, 0xE041], [0x26B1, 0xE042], [0x26BD, 0xE043],
    [0x26BE, 0xE044], [0x26C4, 0xE045], [0x26C5, 0xE046], [0x26CE, 0xE047],
    [0x26CF, 0xE048], [0x26D1, 0xE049], [0x26D3, 0xE04A], [0x26D4, 0xE04B],
    [0x26E9, 0xE04C], [0x26EA, 0xE04D], [0x26F0, 0xE04E], [0x26F1, 0xE04F],
    [0x26F2, 0xE050], [0x26F3, 0xE051], [0x26F4, 0xE052], [0x26F5, 0xE053],
    [0x26F7, 0xE054], [0x26F8, 0xE055], [0x26F9, 0xE056], [0x26FA, 0xE057],
    [0x26FD, 0xE058], [0x2702, 0xE059], [0x2705, 0xE05A], [0x2708, 0xE05B],
    [0x2709, 0xE05C], [0x270A, 0xE05D], [0x270B, 0xE05E], [0x270C, 0xE05F],
    [0x270D, 0xE060], [0x270F, 0xE061], [0x2712, 0xE062], [0x2714, 0xE063],
    [0x2716, 0xE064], [0x271D, 0xE065], [0x2721, 0xE066], [0x2728, 0xE067],
    [0x2733, 0xE068], [0x2734, 0xE069], [0x2744, 0xE06A], [0x2747, 0xE06B],
    [0x274C, 0xE06C], [0x274E, 0xE06D], [0x2753, 0xE06E], [0x2754, 0xE06F],
    [0x2755, 0xE070], [0x2757, 0xE071], [0x2763, 0xE072], [0x2764, 0xE073],
    [0x2795, 0xE074], [0x2796, 0xE075], [0x2797, 0xE076], [0x27A1, 0xE077],
    [0x27B0, 0xE078], [0x27BF, 0xE079], [0x2934, 0xE07A], [0x2935, 0xE07B],
    [0x2B05, 0xE07C], [0x2B06, 0xE07D], [0x2B07, 0xE07E], [0x2B1B, 0xE07F],
    [0x2B1C, 0xE080], [0x2B50, 0xE081], [0x2B55, 0xE082], [0x1F600, 0xE083],
    [0x1F601, 0xE084], [0x1F602, 0xE085], [0x1F603, 0xE086], [0x1F604, 0xE087],
    [0x1F605, 0xE088], [0x1F606, 0xE089], [0x1F607, 0xE08A], [0x1F608, 0xE08B],
    [0x1F609, 0xE08C], [0x1F60A, 0xE08D], [0x1F60B, 0xE08E], [0x1F60C, 0xE08F],
    [0x1F60D, 0xE090], [0x1F60E, 0xE091], [0x1F60F, 0xE092], [0x1F610, 0xE093],
    [0x1F611, 0xE094], [0x1F612, 0xE095], [0x1F613, 0xE096], [0x1F614, 0xE097],
    [0x1F615, 0xE098], [0x1F616, 0xE099], [0x1F617, 0xE09A], [0x1F618, 0xE09B],
    [0x1F619, 0xE09C], [0x1F61A, 0xE09D], [0x1F61B, 0xE09E], [0x1F61C, 0xE09F],
    [0x1F61D, 0xE0A0], [0x1F61E, 0xE0A1], [0x1F61F, 0xE0A2], [0x1F620, 0xE0A3],
    [0x1F621, 0xE0A4], [0x1F622, 0xE0A5], [0x1F623, 0xE0A6], [0x1F624, 0xE0A7],
    [0x1F625, 0xE0A8], [0x1F626, 0xE0A9], [0x1F627, 0xE0AA], [0x1F628, 0xE0AB],
    [0x1F629, 0xE0AC], [0x1F62A, 0xE0AD], [0x1F62B, 0xE0AE], [0x1F62C, 0xE0AF],
    [0x1F62D, 0xE0B0], [0x1F62E, 0xE0B1], [0x1F62F, 0xE0B2], [0x1F630, 0xE0B3],
    [0x1F631, 0xE0B4], [0x1F632, 0xE0B5], [0x1F633, 0xE0B6], [0x1F634, 0xE0B7],
    [0x1F635, 0xE0B8], [0x1F636, 0xE0B9], [0x1F637, 0xE0BA], [0x1F641, 0xE0BB],
    [0x1F642, 0xE0BC], [0x1F643, 0xE0BD], [0x1F644, 0xE0BE], [0x1F910, 0xE0BF],
    [0x1F911, 0xE0C0], [0x1F912, 0xE0C1], [0x1F913, 0xE0C2], [0x1F914, 0xE0C3],
    [0x1F915, 0xE0C4], [0x1F916, 0xE0C5], [0x1F917, 0xE0C6], [0x1F920, 0xE0C7],
    [0x1F921, 0xE0C8], [0x1F922, 0xE0C9], [0x1F923, 0xE0CA], [0x1F924, 0xE0CB],
    [0x1F925, 0xE0CC], [0x1F927, 0xE0CD], [0x1F928, 0xE0CE], [0x1F929, 0xE0CF],
    [0x1F92A, 0xE0D0], [0x1F92B, 0xE0D1], [0x1F92C, 0xE0D2], [0x1F92D, 0xE0D3],
    [0x1F92E, 0xE0D4], [0x1F92F, 0xE0D5], [0x1F970, 0xE0D6], [0x1F971, 0xE0D7],
    [0x1F973, 0xE0D8], [0x1F974, 0xE0D9], [0x1F975, 0xE0DA], [0x1F976, 0xE0DB],
    [0x1F97A, 0xE0DC], [0x1F44A, 0xE0DD], [0x1F44B, 0xE0DE], [0x1F44C, 0xE0DF],
    [0x1F44D, 0xE0E0], [0x1F44E, 0xE0E1], [0x1F44F, 0xE0E2], [0x1F450, 0xE0E3],
    [0x1F4AA, 0xE0E4], [0x1F64B, 0xE0E5], [0x1F64C, 0xE0E6], [0x1F64D, 0xE0E7],
    [0x1F64E, 0xE0E8], [0x1F64F, 0xE0E9], [0x1F91D, 0xE0EA], [0x1F91E, 0xE0EB],
    [0x1F91F, 0xE0EC], [0x1F932, 0xE0ED], [0x1F933, 0xE0EE], [0x1F494, 0xE0EF],
    [0x1F495, 0xE0F0], [0x1F496, 0xE0F1], [0x1F497, 0xE0F2], [0x1F498, 0xE0F3],
    [0x1F499, 0xE0F4], [0x1F49A, 0xE0F5], [0x1F49B, 0xE0F6], [0x1F49C, 0xE0F7],
    [0x1F49D, 0xE0F8], [0x1F49E, 0xE0F9], [0x1F49F, 0xE0FA], [0x1F5A4, 0xE0FB],
    [0x1F9E1, 0xE0FC], [0x1F4A1, 0xE0FD], [0x1F4A5, 0xE0FE], [0x1F4A8, 0xE0FF],
    [0x1F4A9, 0xE100], [0x1F4AB, 0xE101], [0x1F4AC, 0xE102], [0x1F4AD, 0xE103],
    [0x1F4AF, 0xE104], [0x1F4B0, 0xE105], [0x1F4B2, 0xE106], [0x1F4B5, 0xE107],
    [0x1F4B8, 0xE108], [0x1F4BB, 0xE109], [0x1F4BC, 0xE10A], [0x1F4C8, 0xE10B],
    [0x1F4C9, 0xE10C], [0x1F4CA, 0xE10D], [0x1F4CB, 0xE10E], [0x1F4CC, 0xE10F],
    [0x1F4CD, 0xE110], [0x1F4CE, 0xE111], [0x1F4D6, 0xE112], [0x1F4DA, 0xE113],
    [0x1F4DD, 0xE114], [0x1F4E7, 0xE115], [0x1F4F1, 0xE116], [0x1F4F2, 0xE117],
    [0x1F504, 0xE118], [0x1F50D, 0xE119], [0x1F50E, 0xE11A], [0x1F511, 0xE11B],
    [0x1F512, 0xE11C], [0x1F513, 0xE11D], [0x1F517, 0xE11E], [0x1F525, 0xE11F],
    [0x1F527, 0xE120], [0x1F528, 0xE121], [0x1F529, 0xE122], [0x1F52A, 0xE123],
    [0x1F52E, 0xE124], [0x1F52F, 0xE125], [0x1F31F, 0xE126], [0x1F320, 0xE127],
    [0x1F332, 0xE128], [0x1F333, 0xE129], [0x1F337, 0xE12A], [0x1F338, 0xE12B],
    [0x1F339, 0xE12C], [0x1F33A, 0xE12D], [0x1F33B, 0xE12E], [0x1F33C, 0xE12F],
    [0x1F340, 0xE130], [0x1F341, 0xE131], [0x1F342, 0xE132], [0x1F343, 0xE133],
    [0x1F34E, 0xE134], [0x1F34F, 0xE135], [0x1F355, 0xE136], [0x1F354, 0xE137],
    [0x1F370, 0xE138], [0x1F382, 0xE139], [0x1F381, 0xE13A], [0x1F389, 0xE13B],
    [0x1F38A, 0xE13C], [0x1F38B, 0xE13D], [0x1F3AE, 0xE13E], [0x1F3AF, 0xE13F],
    [0x1F3C6, 0xE140], [0x1F3C8, 0xE141], [0x1F680, 0xE142], [0x1F681, 0xE143],
    [0x1F6A8, 0xE144], [0x1F6AB, 0xE145], [0x1F6B2, 0xE146], [0x1F6D1, 0xE147],
    [0x1F947, 0xE148], [0x1F948, 0xE149], [0x1F949, 0xE14A], [0x1F9E0, 0xE14B],
    [0x1F9EE, 0xE14C], [0x1F9F2, 0xE14D], [0x1F9F0, 0xE14E],
  ]),

  getEmojiPUA(char) {
    if (!this.emojiFont) return null;
    const pua = this.EMOJI_TO_PUA.get(char.codePointAt(0));
    return pua ? String.fromCharCode(pua) : null;
  },

  isPUAEmoji(char) {
    const code = char.codePointAt(0);
    return code >= 0xE000 && code <= 0xE14E;
  },

  /**
   * Converts a LaTeX string to a PNG data URL using MathJax SVG + Canvas
   * @param {string} tex - LaTeX string (without delimiters)
   * @param {boolean} display - display mode (true) or inline (false)
   * @param {number} scale - scale factor for resolution
   * @returns {Promise<{dataUrl: string, width: number, height: number}>}
   */
  async latexToPng(tex, display = true, scale = 3) {
    const svgContainer = await MathJax.tex2svgPromise(tex, { display });
    const svgElement = svgContainer.querySelector('svg');
    if (!svgElement) throw new Error('MathJax did not produce SVG');

    const svgClone = svgElement.cloneNode(true);

    // Replace "currentColor" with explicit black — data URL SVGs have no inherited color
    svgClone.querySelectorAll('[stroke="currentColor"]').forEach(el => el.setAttribute('stroke', '#000000'));
    svgClone.querySelectorAll('[fill="currentColor"]').forEach(el => el.setAttribute('fill', '#000000'));
    const rootG = svgClone.querySelector('g[stroke="currentColor"]');
    if (rootG) { rootG.setAttribute('stroke', '#000000'); rootG.setAttribute('fill', '#000000'); }

    const widthEx = parseFloat(svgClone.getAttribute('width') || '10');
    const heightEx = parseFloat(svgClone.getAttribute('height') || '3');
    const exToPx = 8 * scale;
    const pixelWidth = Math.ceil(widthEx * exToPx);
    const pixelHeight = Math.ceil(heightEx * exToPx);

    svgClone.setAttribute('width', pixelWidth + 'px');
    svgClone.setAttribute('height', pixelHeight + 'px');
    svgClone.removeAttribute('style');
    svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svgClone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

    const svgString = new XMLSerializer().serializeToString(svgClone);
    const svgDataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, pixelWidth, pixelHeight);
        resolve({
          dataUrl: canvas.toDataURL('image/png'),
          width: pixelWidth / scale / 96 * 25.4,
          height: pixelHeight / scale / 96 * 25.4,
        });
      };
      img.onerror = () => reject(new Error('Failed to render LaTeX SVG'));
      img.src = svgDataUrl;
    });
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
      // Convert keycap emoji sequences (1️⃣ 2️⃣ etc.) to "1." "2." before stripping
      .replace(/([\d#*])\uFE0F?\u20E3/g, '$1.')
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
      // Remove combining enclosing keycap (leftover from keycap sequences)
      .replace(/\u20E3/g, '')
      // General punctuation block (various special spaces)
      .replace(/[\u2000-\u200A]/g, ' ')
      // Remove word joiners and other invisible chars
      .replace(/[\u2060-\u206F]/g, '')
      // BMP emoji (misc symbols, dingbats, arrows, etc.): replace supported with PUA
      .replace(/[\u231A-\u27BF\u2934-\u2935\u2B05-\u2B55]/g, char => {
        const pua = this.getEmojiPUA(char);
        return pua || '';
      })
      // Supplementary plane emojis: replace supported ones with PUA, strip others
      .replace(/[\u{1F300}-\u{1F9FF}]/gu, char => {
        const pua = this.getEmojiPUA(char);
        return pua || '';
      });

    // Final cleanup: ensure only printable ASCII, extended Latin, and PUA emoji
    // Use Array.from to correctly iterate over multi-byte characters
    result = Array.from(result).map(char => {
      const code = char.codePointAt(0);
      // Allow: printable ASCII (32-126), newlines/tabs, and extended Latin (160-255)
      if ((code >= 32 && code <= 126) || code === 10 || code === 13 || code === 9 || (code >= 160 && code <= 255)) {
        return char;
      }
      // Allow PUA emoji characters (already remapped)
      if (this.isPUAEmoji(char)) {
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
   * @param {string} platform - Platform name (Claude, ChatGPT, or Gemini)
   * @param {Object} settings - User settings for customization
   * @returns {Promise<jsPDF>}
   */
  async export(conversationData, platform = 'Claude', settings = {}) {
    this.platform = platform;
    this.settings = settings;
    await this.loadLibrary();
    this.initDocument();
    this.renderHeader(conversationData);
    await this.renderMessages(conversationData.messages);
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
    if (!window.MathJax) {
      // Configure MathJax before loading
      window.MathJax = {
        tex: { packages: {'[+]': ['ams', 'noerrors', 'noundefined']} },
        svg: { fontCache: 'local' },
        startup: { typeset: false }
      };
      await loadScript('lib/tex-svg.js');
      // Wait for MathJax to fully initialize
      if (MathJax.startup && MathJax.startup.promise) {
        await MathJax.startup.promise;
      }
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
      try {
        this.doc.addFileToVFS('NotoEmoji.ttf', window.EMOJI_FONT_BASE64);
        this.doc.addFont('NotoEmoji.ttf', 'NotoEmoji', 'normal');
        // Verify font was registered by trying to set it
        this.doc.setFont('NotoEmoji', 'normal');
        this.doc.setFont('helvetica', 'normal');
        this.emojiFont = true;
        console.log('Emoji font registered successfully');
      } catch (e) {
        console.error('Failed to register emoji font:', e);
        this.emojiFont = false;
      }
    } else {
      console.log('EMOJI_FONT_BASE64 not available');
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
  async renderMessages(messages) {
    for (const message of messages) {
      await this.renderMessage(message);
    }
  },

  /**
   * Renders a single message
   * @param {Object} message
   */
  async renderMessage(message) {
    const isUser = message.role === 'user';

    this.checkPageBreak(20);
    this.renderMessageHeader(isUser);
    await this.renderMessageContent(message.content, isUser);
    this.renderMessageSeparator();
  },

  /**
   * Renders message header (You/Assistant label)
   * @param {boolean} isUser
   */
  /**
   * Converts hex color string to RGB array
   * @param {string} hex - Color in #RRGGBB format
   * @returns {number[]} [r, g, b]
   */
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
      : [128, 128, 128];
  },

  renderMessageHeader(isUser) {
    const { doc, margin, contentWidth, platform } = this;
    const s = this.settings || {};

    doc.setFont(undefined, 'bold');
    doc.setFontSize(s.headerFontSize || 11);

    // Get header color from settings or use defaults
    let color;
    if (isUser) {
      color = this.hexToRgb(s.userHeaderColor || '#3B82F6');
    } else if (platform === 'ChatGPT') {
      color = this.hexToRgb(s.chatgptHeaderColor || '#10A37F');
    } else if (platform === 'Gemini') {
      color = this.hexToRgb(s.geminiHeaderColor || '#A87FFF');
    } else {
      color = this.hexToRgb(s.claudeHeaderColor || '#D97706');
    }
    doc.setFillColor(color[0], color[1], color[2]);
    doc.setTextColor(255, 255, 255);

    // Scale rectangle and text position based on header font size
    const fontSize = s.headerFontSize || 11;
    const fontPt = fontSize * 0.3528; // pt to mm
    const rectHeight = fontPt + 4;
    const rectTop = this.yPosition - rectHeight / 2;

    doc.roundedRect(margin, rectTop, contentWidth, rectHeight, 2, 2, 'F');

    // Get display name from settings or use defaults
    const userLabel = s.userDisplayName || 'You';
    let llmLabel = platform;
    if (platform === 'Claude' && s.claudeDisplayName) llmLabel = s.claudeDisplayName;
    else if (platform === 'ChatGPT' && s.chatgptDisplayName) llmLabel = s.chatgptDisplayName;
    else if (platform === 'Gemini' && s.geminiDisplayName) llmLabel = s.geminiDisplayName;
    // Position text baseline so cap-height is vertically centered in rect
    // Cap-height is ~70% of font size; baseline = rectTop + (rectHeight + capHeight) / 2
    const capHeight = fontPt * 0.7;
    const textY = rectTop + (rectHeight + capHeight) / 2;
    doc.text(isUser ? userLabel : llmLabel, margin + 5, textY);
    this.yPosition = rectTop + rectHeight + 4;
  },

  /**
   * Renders message content
   * @param {string} content
   * @param {boolean} isUser
   */
  async renderMessageContent(content, isUser) {
    const { doc } = this;
    const s = this.settings || {};

    doc.setTextColor(30, 30, 30);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(s.contentFontSize || 10);

    // Parse content first (before normalizing) to preserve LaTeX delimiters
    const parts = this.parseContent(content);

    for (const part of parts) {
      if (part.type === 'text') {
        this.renderTextPart(this.normalizeText(part.content));
      } else if (part.type === 'code') {
        this.renderCodeBlock(part);
      } else if (part.type === 'table') {
        this.renderTable(part.content);
      } else if (part.type === 'latex') {
        await this.renderLatexBlock(part);
      }
    }

    this.yPosition += 8;
  },

  /**
   * Parses content into text, code, and table parts
   * @param {string} content
   * @returns {Array}
   */
  parseContent(content) {
    const parts = [];
    const codeBlockRegex = /```([^\n]*)\n([\s\S]*?)```/g;
    const tableRegex = /(\|.+\|[\r\n]+\|[-:\s|]+\|[\r\n]+(?:\|.+\|[\r\n]*)+)/g;
    // Display LaTeX: $$ ... $$ (must NOT match single $ used for currency etc.)
    const displayLatexRegex = /\$\$([\s\S]+?)\$\$/g;
    // Inline LaTeX: $ ... $ (single $, but content must start with backslash to avoid false positives)
    const inlineLatexRegex = /\$(\\[a-zA-Z][\s\S]*?)\$/g;

    let lastIndex = 0;

    // Find all special blocks with their positions
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

    while ((match = displayLatexRegex.exec(content)) !== null) {
      const isInsideCode = blocks.some(b => b.type === 'code' && match.index >= b.start && match.index < b.end);
      if (!isInsideCode) {
        blocks.push({
          type: 'latex',
          start: match.index,
          end: match.index + match[0].length,
          content: match[1].trim(),
          display: true
        });
      }
    }

    while ((match = inlineLatexRegex.exec(content)) !== null) {
      const isInsideOther = blocks.some(b => match.index >= b.start && match.index < b.end);
      if (!isInsideOther) {
        blocks.push({
          type: 'latex',
          start: match.index,
          end: match.index + match[0].length,
          content: match[1].trim(),
          display: false
        });
      }
    }

    while ((match = tableRegex.exec(content)) !== null) {
      const isInsideOther = blocks.some(b => match.index >= b.start && match.index < b.end);
      if (!isInsideOther) {
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
        parts.push({ type: 'code', language: block.language, content: block.content });
      } else if (block.type === 'table') {
        parts.push({ type: 'table', content: block.content });
      } else if (block.type === 'latex') {
        parts.push({ type: 'latex', content: block.content, display: block.display });
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
    const s = this.settings || {};

    doc.setFont(undefined, 'normal');
    doc.setFontSize(s.contentFontSize || 10);
    doc.setTextColor(30, 30, 30);

    const paragraphs = content.split('\n');

    paragraphs.forEach(paragraph => {
      if (!paragraph.trim()) {
        this.yPosition += 3;
        return;
      }

      // Render horizontal rules as lines with spacing
      if (paragraph.trim() === '---') {
        this.yPosition += 4;
        this.checkPageBreak(6);
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.4);
        doc.line(margin + 3, this.yPosition, margin + contentWidth - 3, this.yPosition);
        this.yPosition += 6;
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
      // Replace PUA emoji with 'W' for width estimation (splitTextToSize can't measure PUA glyphs)
      const textForMeasure = textForWrapping.replace(/[\uE000-\uE14E]/g, 'W');
      const availableWidth = bulletChar ? contentWidth - (indent - margin) - 3 : contentWidth - 6;
      const measureLines = doc.splitTextToSize(textForMeasure, availableWidth);
      // Map the line breaks back onto the original text (preserving PUA chars)
      const lines = [];
      let srcIdx = 0;
      measureLines.forEach(ml => {
        lines.push(textForWrapping.substring(srcIdx, srcIdx + ml.length));
        srcIdx += ml.length;
        // Skip whitespace at line break boundaries
        while (srcIdx < textForWrapping.length && textForWrapping[srcIdx] === ' ') srcIdx++;
      });
      if (srcIdx < textForWrapping.length) {
        lines.push(textForWrapping.substring(srcIdx));
      }

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
   * Renders a LaTeX equation as an image in the PDF
   * @param {Object} part - { content: string, display: boolean }
   */
  async renderLatexBlock(part) {
    const { doc, margin, contentWidth } = this;

    try {
      const result = await this.latexToPng(part.content, part.display, 3);

      const maxWidth = contentWidth - 10;
      let imgWidth = result.width;
      let imgHeight = result.height;
      if (imgWidth > maxWidth) {
        const ratio = maxWidth / imgWidth;
        imgWidth = maxWidth;
        imgHeight *= ratio;
      }

      this.checkPageBreak(imgHeight + 6);

      // Center display equations, left-align inline
      const x = part.display ? margin + (contentWidth - imgWidth) / 2 : margin + 3;
      doc.addImage(result.dataUrl, 'PNG', x, this.yPosition, imgWidth, imgHeight);
      this.yPosition += imgHeight + (part.display ? 6 : 4);
    } catch (e) {
      // Fallback: render raw LaTeX as text if MathJax fails
      console.error('LaTeX render failed:', e);
      doc.setFont('courier', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      const delimiter = part.display ? '$$' : '$';
      const fallbackText = `${delimiter}${part.content}${delimiter}`;
      const lines = doc.splitTextToSize(fallbackText, contentWidth - 6);
      lines.forEach(line => {
        this.checkPageBreak(5);
        doc.text(line, margin + 3, this.yPosition);
        this.yPosition += 4;
      });
      this.yPosition += 4;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 30, 30);
    }
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
      const isEmoji = this.isPUAEmoji(char);
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
          doc.text(run.text, currentX, this.yPosition);
          // Emoji advance width = 2600/2048 = 1.27x font size (from font metrics)
          const fontSize = doc.getFontSize();
          currentX += run.text.length * fontSize * 1.27 * 25.4 / 72;
        } else {
          doc.setFont('helvetica', segment.bold ? 'bold' : 'normal');
          doc.text(run.text, currentX, this.yPosition);
          currentX += doc.getTextWidth(run.text);
        }
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
