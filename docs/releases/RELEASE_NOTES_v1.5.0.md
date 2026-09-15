# Capsula 1.5.0

Faster exports, saved images, and a smoother experience inside ChatGPT.

- **Faster conversation loading.** Capsula now reads ChatGPT's conversation JSON first,
  reducing the need to scroll through long chats. Page-based collection remains available
  when the API cannot be used.
- **Richer thinking details.** Exports preserve available thinking summaries, step labels,
  and timing information, alongside message timestamps and model information.
- **Images that stay with your export.** Available images are downloaded and embedded in
  HTML and Markdown files and clipboard copies, so successfully saved images remain after
  ChatGPT's links expire. Embedding is enabled by default in Settings → Behavior.
- **Clear loading progress.** A conversation overlay shows collection progress and message
  counts, and covers scroll movement when Capsula needs to collect the page.
- **Move the export button.** Drag it to a comfortable position. Capsula remembers it across
  sessions, keeps it inside the window on resize, and offers Reset to corner in Settings →
  Appearance.
- **A more reliable export panel.** Fixed panels disappearing after a quick reopen and
  closing during URL changes that keep the same conversation.

Image downloads may ask for optional access to ChatGPT's image hosts. If an image cannot be
embedded, its original link remains. Markdown viewers need data URI support to display
embedded images; JSON and GitHub/Notion exports continue to use image URLs.

All export processing stays in your browser. No telemetry or Capsula servers.

Developer details and regression coverage: [CHANGELOG.md](https://github.com/sevenevesai/capsula/blob/v1.5.0/CHANGELOG.md#150---2026-09-15).
