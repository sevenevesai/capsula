/* ===========================
   Settings Styles
   =========================== */
const SettingsStyles = {
  get(colors) {
    return `
      .settings-container {
        height: 100%;
        display: flex;
        flex-direction: column;
      }
      
      .settings-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid ${colors.border};
        background: ${colors.bgSecondary};
      }
      
      .settings-header h2 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: ${colors.text};
      }
      
      .back-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        background: transparent;
        border: 1px solid ${colors.border};
        color: ${colors.text};
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s;
      }
      
      .back-btn:hover {
        background: ${colors.hover};
      }
      
      .settings-body {
        flex: 1;
        padding: 20px;
        overflow-y: auto;
        background: ${colors.bg};
      }
      
      .setting-group {
        margin-bottom: 32px;
      }
      
      .setting-group h3 {
        margin: 0 0 16px 0;
        font-size: 16px;
        font-weight: 600;
        color: ${colors.text};
      }
      
      .setting-item {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
        color: ${colors.text};
        font-size: 14px;
      }
      
      .setting-item label {
        min-width: 120px;
      }
      
      .setting-item input[type="checkbox"] {
        width: 18px;
        height: 18px;
        cursor: pointer;
      }
      
      .setting-select {
        flex: 1;
        max-width: 200px;
        padding: 6px 10px;
        border: 1px solid ${colors.border};
        background: ${colors.bgSecondary};
        color: ${colors.text};
        border-radius: 6px;
        font-size: 13px;
        cursor: pointer;
      }
      
      .color-settings {
        flex-direction: column;
        align-items: flex-start;
      }
      
      .color-inputs {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 8px;
      }
      
      .color-inputs > div {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .color-inputs label {
        min-width: 80px;
        font-size: 13px;
      }
      
      .color-inputs input[type="color"] {
        width: 50px;
        height: 30px;
        border: 1px solid ${colors.border};
        border-radius: 4px;
        cursor: pointer;
      }
      
      .reset-color {
        padding: 4px 8px;
        background: transparent;
        border: 1px solid ${colors.border};
        color: ${colors.textSecondary};
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .reset-color:hover {
        background: ${colors.hover};
      }
      
      .setting-item textarea {
        width: 100%;
        min-height: 60px;
        padding: 8px;
        border: 1px solid ${colors.border};
        background: ${colors.bgSecondary};
        color: ${colors.text};
        border-radius: 6px;
        font-size: 13px;
        font-family: inherit;
        resize: vertical;
      }
      
      .settings-footer {
        display: flex;
        align-items: center;
        padding: 16px 20px;
        border-top: 1px solid ${colors.border};
        background: ${colors.bgSecondary};
      }

      /* Integration Settings Styles */
      .setting-description {
        color: ${colors.textSecondary};
        font-size: 13px;
        margin-bottom: 16px;
      }

      .integration-section {
        margin-bottom: 24px;
        padding: 16px;
        border: 1px solid ${colors.border};
        border-radius: 8px;
        background: ${colors.bgSecondary};
      }

      .integration-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }

      .integration-header h4 {
        margin: 0;
        font-size: 15px;
        font-weight: 600;
        color: ${colors.text};
      }

      .integration-status {
        font-size: 13px;
        font-weight: 500;
        padding: 4px 8px;
        border-radius: 4px;
        background: ${colors.hover};
      }

      .token-input-group {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .integration-token-input {
        flex: 1;
        padding: 8px 12px;
        border: 1px solid ${colors.border};
        background: ${colors.bg};
        color: ${colors.text};
        border-radius: 6px;
        font-size: 13px;
        font-family: monospace;
      }

      .setting-hint {
        display: block;
        margin-top: 6px;
        font-size: 12px;
        color: ${colors.textSecondary};
        line-height: 1.4;
      }

      .setting-hint a {
        color: ${colors.accentPrimary};
        text-decoration: none;
      }

      .setting-hint a:hover {
        text-decoration: underline;
      }

      .integration-actions {
        display: flex;
        gap: 8px;
        margin-top: 12px;
      }

      .integration-result {
        margin-top: 12px;
        padding: 8px 12px;
        border-radius: 6px;
        background: ${colors.hover};
        font-size: 13px;
      }
    `;
  }
};

