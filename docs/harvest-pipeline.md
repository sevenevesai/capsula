# Harvest pipeline

How a ChatGPT thread becomes the `{ meta, messages }` object every exporter consumes. Code:
`src/content/18-conversation-api.js`, `18-harvester.js`, `16-image-embedder.js`, `test/run-fixtures.js`.

## Sources

**Conversation API (primary).** `ConversationApi.load(location.href)` reads the conversation id
from `/c/<uuid>` (also `/g/<gpt>/c/<uuid>`), fetches the access token from `/api/auth/session`,
then `GET /backend-api/conversation/<id>` with a Bearer header. These are the same same-origin
requests the page makes. The token is used per harvest and never stored. Shared links
(`/share/...`) have no id in that form and stay on the DOM path.

The payload is a tree (`mapping`); `linearPath()` follows `parent` links from `current_node` to
the root, which is the branch the page displays. `isVisible()` keeps user text, assistant text,
`thoughts`, `reasoning_recap`, and tool messages carrying image results; it drops anything
marked `is_visually_hidden_from_conversation` or addressed to a tool (`recipient !== 'all'`).
`groupTurns()` folds consecutive assistant-side messages into one turn, the way the page renders
them. `toMessage()` builds the harvest message shape: markdown parts go through `MarkdownBlocks`,
image parts become image blocks with an `assetPointer`, thoughts become thinking labels plus a
`thinking.text` summary, the recap becomes the time label.

Image asset pointers (`file-service://file-…`, `sediment://file_…`) resolve to signed URLs through
`/backend-api/files/<id>/download`; a second endpoint spelling is tried on failure. Neither is
documented. Unresolved images keep an empty `src` and an "(unavailable)" alt.

**DOM (content and fallback).** `Harvester.collectAllMessages()` reads mounted turns. When the
API succeeded, `mergeApiWithDom()` walks the API turns in order and, for each one whose message
ids match a mounted DOM turn (`messageIds`, gathered from every `data-message-id` inside the turn,
because turn ids differ from message ids), keeps the DOM message's blocks and thinking while
taking the API timestamp and model. Turns not in the DOM come from the API as built. The DOM
wins on content because it carries rendered MathML, mermaid SVG, canvas detection and citation
cards that the raw markdown does not.

When the API throws for any reason, `collectMessagesWithScrollSweep()` runs as before: it skips
scrolling when `isHeadMounted()` sees contiguous `conversation-turn-N` testids from 1 with no
viewport-sized gap above turn 1 and the scroller is at the bottom; otherwise it sweeps behind
`HarvestCurtain`. The curtain covers the scroller for every harvest: translucent with a progress
bar while the API and the page are read (`ConversationApi.load()` reports phases), switched
opaque by the sweep so scroll jumps stay invisible, and held at least 450 ms so a fast harvest
still reads as a transition. `Harvester.lastTurnStrategy` records
which selector tier found turns; null after a harvest means the page markup changed.

`meta.source` is `'api'` or `'dom'`; API harvests also carry `conversation_id`, `created_at`,
`updated_at`. Messages carry `source` (`'api'`, or `'dom'` when a DOM turn supplied the content).

## MarkdownBlocks

Converts ChatGPT's stored markdown into the block shape the DOM extractor emits (`kind` of
`heading`, `para`, `list`, `code`, `table`, `quote`, `divider`, `image`, `math`). Inline
formatting stays as markdown inside `md`/`text`, which is what the renderers expect. `\( \)`
becomes `$…$` and `\[ \]` a `math` block, matching the DOM path's markdown output; there is no
MathML on this path, so HTML exports of API-only turns show LaTeX source. Citation markers
(private-use glyph runs and `【n†source】`) are stripped. List nesting is by indentation and an
item's `ordered` flag describes its children, as in the DOM tree. Tables produce `rows` plus an
`html` built with `MessageFormatter.formatInlineMarkdown`.

Not handled: setext headings, fenced code inside list items, lazy continuation lines, raw HTML.
Those fall through as paragraphs or end the list early.

## Image embedding

`ImageEmbedder.embed(harvest)` runs from `ExportManager.export()`/`copy()` for HTML and Markdown
when `settings.embedImages` is on. It collects `https:` image block sources, fetches each
directly first (same-origin and CORS-enabled hosts), and sends the cross-origin failures to the
background broker's `HTTP_BLOB` action, which needs the optional host permission for that origin
(`ensurePermissions()` checks, then requests once per host; hosts outside the manifest patterns
cannot be granted and stay as links). Results are cached on `harvest.imageCache`. Caps: 15 MB per
image, 60 MB per export. JSON exports and the GitHub/Notion integrations never embed.

## Fixtures

`npm test` builds Firefox and runs `test/run-fixtures.js`, which loads `dist/firefox/content.js`
into jsdom on a non-ChatGPT origin (so `App.init()` mounts nothing), runs each `test/fixtures/*.html`
through `Harvester.collectAllMessages()` and each `*.json` through
`ConversationApi.messagesFromConversation()`, exports Markdown, strips the clock-dependent
`**Exported**` line, and diffs against `test/golden/<name>.md`. Add a fixture by saving a page or
turn `outerHTML` snapshot, or a conversation JSON payload, into `test/fixtures/` and running
`npm run test:update`; commit the golden after reading it. jsdom has no layout, so `offsetHeight`,
`innerText` and computed styles are stubs: the sweep, curtain and button placement are not
covered, and thinking-detection strategy 2 (height-based) is inert there.

Before committing a full-page snapshot, keep only the conversation DOM and remove page scripts
and account/sidebar state. ChatGPT's serialized page state can include session tokens. After
removal, `npm test` must still match the expected conversation export.

## Known gaps and unverified assumptions

- The conversation and files endpoints, header requirements and payload shapes are from
  observation, not documentation. The user-facing test round validates them; failures land in the
  console as "Conversation API unavailable" and the DOM sweep runs instead.
- `sediment://` download URL resolution is a best guess with two candidate endpoints.
- Canvas documents and code-interpreter input/output are not reconstructed from the API; a
  mounted DOM turn still supplies canvas detection. Tool-directed assistant messages are excluded.
- The API path does not detect edits/regenerations beyond following the displayed branch.
