
/**
 * Capsula v1.5.0 - ChatGPT Export Extension
 *
 * A browser extension for exporting ChatGPT conversations with improved
 * model detection, thinking state capture, media handling, and settings.
 * 
 * @author Mark T. Short (seveneves.ai)
 * @license MIT
 * @copyright 2025
 * 
 * Security & Compliance:
 * - Content and background scripts only
 * - No eval() or remote code execution
 * - No external dependencies or CDN resources
 * - HTML exports include CSP headers
 * - All content is properly escaped
 */

/* ===========================
   Configuration & Constants
   =========================== */
const CFG = {
  // UI positioning
  right: 40,
  bottom: 90,
  minSize: 48,
  zIndex: 2147483000,
  nudgeGap: 12,
  edgeMarginPx: 8, // min gap between a dragged button and the viewport edge
  dragThresholdPx: 4, // pointer travel before a press becomes a drag instead of a click
  
  // Extension metadata
  version: '1.5.0',
  
  // URL pattern for ChatGPT domains
  urlGuard: /^https:\/\/(chat\.openai\.com|chatgpt\.com)\//,
  
  // Performance tuning
  recomputeDebounceMs: 120,
  navCheckIntervalMs: 3000,
  autoExpandDelay: 50, // ms between auto-expand clicks
  scrollSweepDelayMs: 60, // ms to let React mount turns after each sweep step
  scrollSweepMaxSteps: 200, // hard cap on sweep iterations
  sweepCurtainFadeMs: 150, // curtain fade-in/out; scrolling starts only after fade-in
  
  // Panel dimensions
  panelWidth: 900,
  panelHeightVh: 85,
  timelineWidth: 60,
  
  // Supported models (expanded list)
  knownModels: [
    'o1-preview', 'o1-mini', 'o3', 'o3-mini',
    'gpt-5-thinking', 'gpt-5-5', 'gpt-5',
    'gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4',
    'gpt-3.5-turbo'
  ],
  
  // Theme configuration
  theme: {
    light: {
      bg: 'rgba(255,255,255,0.98)',
      bgSecondary: 'rgba(249,250,251,0.98)',
      text: '#111827',
      textSecondary: '#6b7280',
      border: 'rgba(229,231,235,1)',
      hover: 'rgba(243,244,246,1)',
      userBubble: '#3b82f6',
      userTimeline: '#60a5fa',
      assistantBubble: '#f3f4f6',
      assistantTimeline: '#d1d5db',
      thinkingTimeline: '#fbbf24',
      accentPrimary: '#3b82f6',
      accentSecondary: '#10b981',
      exportButton: '#1f2937',
      exportButtonHover: '#111827',
      exportButtonText: 'white',
      highlightGlow: 'rgba(59, 130, 246, 0.75)',
      settingsIcon: '#6b7280'
    },
    dark: {
      bg: 'rgba(23,23,23,0.98)',
      bgSecondary: 'rgba(31,31,31,0.98)',
      text: '#f9fafb',
      textSecondary: '#9ca3af',
      border: 'rgba(55,65,81,1)',
      hover: 'rgba(55,65,81,0.5)',
      userBubble: '#2563eb',
      userTimeline: '#3b82f6',
      assistantBubble: '#374151',
      assistantTimeline: '#6b7280',
      thinkingTimeline: '#f59e0b',
      accentPrimary: '#3b82f6',
      accentSecondary: '#10b981',
      exportButton: '#3b82f6',
      exportButtonHover: '#2563eb',
      exportButtonText: 'white',
      highlightGlow: 'rgba(59, 130, 246, 0.7)',
      settingsIcon: '#9ca3af'
    }
  },
  
  // Enhanced thinking patterns
  thinkingPatterns: {
    timePatterns: [
      /\b(?:Thought|Thinking|Processing|Analyzing|Working)\s+for\s+((\d+(?:\.\d+)?)\s*(?:seconds?|secs?)|(\d+)\s*(?:mins?|minutes?)(?:\s+(?:and\s+)?(\d+)\s*(?:seconds?|secs?))?|(\d+)m\s*(\d+)s)\b/i
    ],
    statePatterns: [
      /\b(Analyzing|Analyzed|Processing|Searching|Thinking|Working|Calculating|Reasoning|Summarizing|Refining|Formatting|Compiling|Running|Executing|Uploading|Transcribing|Translating|Using tools|Tool call(?:ing)?|Calling tool|Browsing|Looking up|Reading|Planning|Outlining|Drafting|Analysis (?:stopped|paused|complete)|Failed to generate|Starting|Stopping|Resuming)(?:\.{0,3}|\s|$)/i
    ]
  }
};
