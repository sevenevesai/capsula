/* ===========================
   Tutorial System
   =========================== */
const TutorialConfig = {
  // Storage key for tutorial completion tracking
  storageKey: 'capsula_tutorial_state',

  // Show tutorials only once per user
  alwaysShow: false,

  // Animation timings
  fadeInDuration: 300,
  stepDelay: 800,

  // Overlay styling
  overlayZIndex: 2147483600,
  spotlightBorder: '3px solid #3b82f6',
  spotlightShadow: '0 0 0 9999px rgba(0, 0, 0, 0.7), 0 0 20px rgba(59, 130, 246, 0.8)',

  // Tooltip positioning
  tooltipOffset: 12,
  tooltipMaxWidth: 320,

  // Tutorial flows
  flows: {
    welcome: {
      id: 'welcome',
      trigger: 'panel-open',
      priority: 1,
      steps: [
        {
          id: 'welcome-1',
          title: '👋 Welcome to Capsula!',
          description: 'Export your ChatGPT conversations with powerful selection and filtering tools. Let\'s take a quick tour!',
          target: '.panel',
          position: 'center',
          buttons: ['skip', 'next']
        },
        {
          id: 'welcome-2',
          title: 'Timeline Overview',
          description: 'This vertical timeline shows your entire conversation. Each segment represents a message (blue = you, gray = ChatGPT). Click and drag to select a range of messages.',
          target: '.timeline-panel',
          position: 'right',
          buttons: ['skip', 'next']
        },
        {
          id: 'welcome-3',
          title: 'Advanced Selection',
          description: '<strong>Pro tip:</strong> Use keyboard shortcuts for precise control:<br>• <strong>Ctrl+Click:</strong> Toggle individual messages<br>• <strong>Shift+Click:</strong> Extend selection<br>• <strong>Right-Click:</strong> Clear all selections',
          target: '.timeline-track',
          position: 'right',
          buttons: ['skip', 'next']
        },
        {
          id: 'welcome-4',
          title: 'Preview Area',
          description: 'See exactly what will be exported. Scroll through your conversation and review the content before exporting.',
          target: '.chat-preview',
          position: 'left',
          buttons: ['skip', 'next']
        },
        {
          id: 'welcome-5',
          title: 'Message Checkboxes',
          description: 'Each message has a checkbox toggle (look for the small checkbox on the role labels). Click to include/exclude specific messages from your export. Great for fine-tuning!',
          target: '.chat-preview',
          position: 'left',
          buttons: ['skip', 'next']
        },
        {
          id: 'welcome-6',
          title: 'Content Filters',
          description: 'Quick filters let you show only what you need: Assistant messages only, Code blocks, Tables, or Lists. Mix and match!',
          target: '.filter-buttons',
          position: 'bottom',
          buttons: ['skip', 'next']
        },
        {
          id: 'welcome-7',
          title: 'Export Formats',
          description: 'Choose your export format: <strong>Markdown</strong> (.md) for clean text, <strong>HTML</strong> for styled pages, or <strong>JSON</strong> for structured data.',
          target: '.format-select',
          position: 'top',
          buttons: ['skip', 'next']
        },
        {
          id: 'welcome-8',
          title: 'GitHub Integration',
          description: 'Export directly to <strong>GitHub Gists</strong> (public/private snippets) or <strong>GitHub Issues</strong>. Configure your token in Settings first!',
          target: '.github-btn',
          position: 'top',
          buttons: ['skip', 'next']
        },
        {
          id: 'welcome-9',
          title: 'Notion Integration',
          description: 'Create beautiful <strong>Notion pages</strong> directly from your conversations. Select a parent page and Capsula handles the formatting!',
          target: '.notion-btn',
          position: 'top',
          buttons: ['skip', 'next']
        },
        {
          id: 'welcome-10',
          title: 'You\'re All Set!',
          description: 'You\'re ready to export! Remember: hover over any button for quick tips. Access Settings to configure integrations or customize appearance.',
          target: '.panel',
          position: 'center',
          buttons: ['done']
        }
      ]
    }
  }
};

class TutorialState {
  constructor() {
    this.currentFlow = null;
    this.currentStepIndex = 0;
    this.completedFlows = new Set();
    this.isActive = false;
    this.load();
  }

  load() {
    if (TutorialConfig.alwaysShow) {
      this.completedFlows.clear();
      return;
    }

    try {
      const stored = localStorage.getItem(TutorialConfig.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        this.completedFlows = new Set(data.completedFlows || []);
      }
    } catch (e) {
      console.warn('[Capsula Tutorial] Failed to load state:', e);
    }
  }

  save() {
    if (TutorialConfig.alwaysShow) {
      return;
    }

    try {
      const data = {
        completedFlows: Array.from(this.completedFlows),
        lastUpdated: Date.now()
      };
      localStorage.setItem(TutorialConfig.storageKey, JSON.stringify(data));
    } catch (e) {
      console.warn('[Capsula Tutorial] Failed to save state:', e);
    }
  }

  shouldShowFlow(flowId) {
    if (TutorialConfig.alwaysShow) {
      return true;
    }
    return !this.completedFlows.has(flowId);
  }

  markFlowComplete(flowId) {
    this.completedFlows.add(flowId);
    this.save();
  }

  resetAll() {
    this.completedFlows.clear();
    this.save();
  }
}

class TutorialOverlay {
  constructor(shadowRoot) {
    this.shadowRoot = shadowRoot;
    this.overlay = null;
    this.spotlight = null;
    this.tooltip = null;
    this.currentTarget = null;
  }

  create() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'tutorial-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: ${TutorialConfig.overlayZIndex};
      pointer-events: none;
      opacity: 0;
      transition: opacity ${TutorialConfig.fadeInDuration}ms ease;
    `;

    this.spotlight = document.createElement('div');
    this.spotlight.className = 'tutorial-spotlight';
    this.spotlight.style.cssText = `
      position: absolute;
      pointer-events: auto;
      border-radius: 8px;
      box-shadow: ${TutorialConfig.spotlightShadow};
      border: ${TutorialConfig.spotlightBorder};
      transition: all 400ms cubic-bezier(0.4, 0, 0.2, 1);
    `;

    this.tooltip = document.createElement('div');
    this.tooltip.className = 'tutorial-tooltip';
    this.tooltip.style.cssText = `
      position: absolute;
      pointer-events: auto;
      max-width: ${TutorialConfig.tooltipMaxWidth}px;
      background: white;
      color: #111827;
      padding: 16px;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
      transition: all 400ms cubic-bezier(0.4, 0, 0.2, 1);
      font-family: system-ui, -apple-system, sans-serif;
    `;

    this.overlay.appendChild(this.spotlight);
    this.overlay.appendChild(this.tooltip);

    return this.overlay;
  }

  show(step, targetElement) {
    if (!this.overlay) return;

    this.currentTarget = targetElement;

    if (step.position === 'center') {
      this.positionCenter(step);
    } else {
      this.positionSpotlight(targetElement);
    }

    this.updateTooltip(step);
    this.positionTooltip(step, targetElement);

    requestAnimationFrame(() => {
      this.overlay.style.opacity = '1';
    });
  }

  positionCenter(step) {
    this.spotlight.style.display = 'none';
  }

  positionSpotlight(targetElement) {
    if (!targetElement) return;

    this.spotlight.style.display = 'block';
    const rect = targetElement.getBoundingClientRect();

    this.spotlight.style.top = `${rect.top}px`;
    this.spotlight.style.left = `${rect.left}px`;
    this.spotlight.style.width = `${rect.width}px`;
    this.spotlight.style.height = `${rect.height}px`;
  }

  updateTooltip(step) {
    const buttonsHtml = this.getButtonsHtml(step.buttons);

    this.tooltip.innerHTML = `
      <div style="margin-bottom: 12px;">
        <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">
          ${step.title}
        </div>
        <div style="font-size: 14px; line-height: 1.5; color: #6b7280;">
          ${step.description}
        </div>
      </div>
      <div style="display: flex; gap: 8px; justify-content: flex-end;">
        ${buttonsHtml}
      </div>
    `;
  }

  getButtonsHtml(buttons) {
    const buttonConfigs = {
      'skip': { label: 'Skip Tour', style: 'secondary', action: 'skip' },
      'next': { label: 'Next', style: 'primary', action: 'next' },
      'done': { label: 'Get Started', style: 'primary', action: 'done' },
      'got-it': { label: 'Got it!', style: 'primary', action: 'done' }
    };

    return buttons.map(btnKey => {
      const config = buttonConfigs[btnKey];
      const isPrimary = config.style === 'primary';
      const baseStyle = `
        padding: 8px 16px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        border: 1px solid;
        transition: all 0.2s;
      `;
      const style = isPrimary
        ? `${baseStyle} background: #3b82f6; color: white; border-color: #3b82f6;`
        : `${baseStyle} background: transparent; color: #6b7280; border-color: #d1d5db;`;

      return `<button class="tutorial-btn" data-action="${config.action}" style="${style}">${config.label}</button>`;
    }).join('');
  }

  positionTooltip(step, targetElement) {
    if (step.position === 'center') {
      this.tooltip.style.top = '50%';
      this.tooltip.style.left = '50%';
      this.tooltip.style.transform = 'translate(-50%, -50%)';
      return;
    }

    if (!targetElement) return;

    const rect = targetElement.getBoundingClientRect();
    const tooltipRect = this.tooltip.getBoundingClientRect();
    const offset = TutorialConfig.tooltipOffset;

    this.tooltip.style.transform = 'none';

    switch (step.position) {
      case 'top':
        this.tooltip.style.top = `${rect.top - tooltipRect.height - offset}px`;
        this.tooltip.style.left = `${rect.left + rect.width / 2 - tooltipRect.width / 2}px`;
        break;
      case 'bottom':
        this.tooltip.style.top = `${rect.bottom + offset}px`;
        this.tooltip.style.left = `${rect.left + rect.width / 2 - tooltipRect.width / 2}px`;
        break;
      case 'left':
        this.tooltip.style.top = `${rect.top + rect.height / 2 - tooltipRect.height / 2}px`;
        this.tooltip.style.left = `${rect.left - tooltipRect.width - offset}px`;
        break;
      case 'right':
        this.tooltip.style.top = `${rect.top + rect.height / 2 - tooltipRect.height / 2}px`;
        this.tooltip.style.left = `${rect.right + offset}px`;
        break;
    }

    this.constrainToViewport();
  }

  constrainToViewport() {
    const rect = this.tooltip.getBoundingClientRect();
    const padding = 16;

    if (rect.right > window.innerWidth - padding) {
      this.tooltip.style.left = `${window.innerWidth - rect.width - padding}px`;
    }
    if (rect.left < padding) {
      this.tooltip.style.left = `${padding}px`;
    }
    if (rect.bottom > window.innerHeight - padding) {
      this.tooltip.style.top = `${window.innerHeight - rect.height - padding}px`;
    }
    if (rect.top < padding) {
      this.tooltip.style.top = `${padding}px`;
    }
  }

  hide() {
    if (!this.overlay) return;

    this.overlay.style.opacity = '0';
    setTimeout(() => {
      if (this.overlay && this.overlay.parentNode) {
        this.overlay.parentNode.removeChild(this.overlay);
      }
    }, TutorialConfig.fadeInDuration);
  }

  destroy() {
    // Immediately remove from DOM to prevent blocking interactions
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }

    this.overlay = null;
    this.spotlight = null;
    this.tooltip = null;
    this.currentTarget = null;
  }
}

class TutorialManager {
  constructor() {
    this.state = new TutorialState();
    this.overlay = null;
    this.currentFlow = null;
    this.currentStepIndex = 0;
    this.shadowRoot = null;
    this.onComplete = null;
  }

  init(shadowRoot) {
    this.shadowRoot = shadowRoot;
  }

  startFlow(flowId, onComplete = null) {
    const flowConfig = TutorialConfig.flows[flowId];
    if (!flowConfig) {
      console.warn(`[Capsula Tutorial] Flow not found: ${flowId}`);
      return;
    }

    if (!this.state.shouldShowFlow(flowId)) {
      return;
    }

    this.currentFlow = flowConfig;
    this.currentStepIndex = 0;
    this.onComplete = onComplete;
    this.state.isActive = true;

    this.showCurrentStep();
  }

  showCurrentStep() {
    if (!this.currentFlow || this.currentStepIndex >= this.currentFlow.steps.length) {
      this.endFlow();
      return;
    }

    const step = this.currentFlow.steps[this.currentStepIndex];

    // Clean up previous overlay
    if (this.overlay) {
      this.overlay.destroy();
    }

    // Safety: Remove any lingering overlays before creating new one
    if (this.shadowRoot) {
      const lingering = this.shadowRoot.querySelectorAll('.tutorial-overlay');
      lingering.forEach(el => {
        if (el.parentNode) {
          el.parentNode.removeChild(el);
        }
      });
    }

    this.overlay = new TutorialOverlay(this.shadowRoot);
    const overlayElement = this.overlay.create();

    overlayElement.addEventListener('click', (e) => {
      const btn = e.target.closest('.tutorial-btn');
      if (!btn) return;

      const action = btn.dataset.action;
      this.handleAction(action);
    });

    this.shadowRoot.appendChild(overlayElement);

    const targetElement = this.findTargetElement(step.target);

    setTimeout(() => {
      this.overlay.show(step, targetElement);
    }, 50);
  }

  findTargetElement(selector) {
    if (selector === '.panel') {
      return this.shadowRoot.querySelector('.panel');
    }
    return this.shadowRoot.querySelector(selector);
  }

  handleAction(action) {
    switch (action) {
      case 'next':
        this.nextStep();
        break;
      case 'skip':
        this.endFlow(true);
        break;
      case 'done':
        this.endFlow();
        break;
    }
  }

  nextStep() {
    this.currentStepIndex++;
    this.showCurrentStep();
  }

  endFlow(skipped = false) {
    // Mark as complete whether skipped or finished - user has seen it either way
    if (this.currentFlow) {
      this.state.markFlowComplete(this.currentFlow.id);
    }

    if (this.overlay) {
      this.overlay.destroy();
      this.overlay = null;
    }

    // Safety: Clean up any lingering tutorial overlays in shadow DOM
    if (this.shadowRoot) {
      const lingering = this.shadowRoot.querySelectorAll('.tutorial-overlay');
      lingering.forEach(el => {
        if (el.parentNode) {
          el.parentNode.removeChild(el);
        }
      });
    }

    this.currentFlow = null;
    this.currentStepIndex = 0;
    this.state.isActive = false;

    if (this.onComplete) {
      this.onComplete();
    }
  }

  isActive() {
    return this.state.isActive;
  }
}

const tutorialManager = new TutorialManager();
