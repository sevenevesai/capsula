/* ===========================
   DOM Elements Management
   =========================== */
let overlayHost = null;
let panelHost = null;
let contextMenuListener = null;
let keyboardShortcutListener = null;
let detachResize = null;
let detachObserver = null;
let navCheckInterval = null;

/* ===========================
   Theme Utilities (Enhanced)
   =========================== */
const ThemeUtils = {
  getTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  },

  isDark() {
    return this.getTheme() === 'dark';
  },

  getColors() {
    return CFG.theme[this.getTheme()];
  },

  getChatGPTFont() {
    const sampleElement = document.querySelector('.text-base, .markdown, article');
    if (sampleElement) {
      const computed = window.getComputedStyle(sampleElement);
      return computed.fontFamily || 'Söhne, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Ubuntu, Cantarell, "Noto Sans", sans-serif, "Helvetica Neue", Arial';
    }
    return 'Söhne, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Ubuntu, Cantarell, "Noto Sans", sans-serif, "Helvetica Neue", Arial';
  }
};

