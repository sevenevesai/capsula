# Capsula 1.6.0

Writing boxes in every export format, a remembered export format, and full-width HTML.

- **Writing boxes.** ChatGPT's draft boxes (a titled message or email with a copy button)
  now export cleanly instead of showing raw `:::writing{…}` markup. They become titled
  blockquotes in Markdown and GitHub, collapsible cards in HTML and the preview, quotes in
  Notion, and `writing` blocks in JSON. When ChatGPT offers several versions (the ① ② tabs),
  every version is exported with its label.
- **Your export format is remembered.** The format you pick in the export panel stays
  selected the next time you open it. Settings → Reset to Defaults returns it to Markdown.
- **Full-width HTML exports.** ChatGPT replies span the page instead of an 800px column;
  your messages stay right-aligned bubbles up to 70% of the width.
- **A wider export panel.** The panel grows to 1400px on large screens and still takes 90%
  of narrower windows.
- **Fixed narrow messages.** Messages in HTML exports and the preview were held to about
  half the available width.

Writing-box versions come from ChatGPT's conversation data, which Capsula reads by default.

All export processing stays in your browser. No telemetry or Capsula servers.

Developer details and regression coverage: [CHANGELOG.md](https://github.com/sevenevesai/capsula/blob/v1.6.0/CHANGELOG.md#160---2026-09-24).
