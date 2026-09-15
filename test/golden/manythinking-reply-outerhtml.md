# Fixture

**Model**: gpt-5-thinking
**Version**: ChatGPT Export v1.5.0

---

## ChatGPT

*Thought for 5s*

*Thought for 29s*

*Thought for 9s*

*Thought for a few seconds*

*Thought for 35s*

*[Expandable content available]*

Awesome—got it. I unpacked the repo and pulled a clean picture. Here’s **(1) the codebase breakdown**, **(2) concrete extension points for the RC overhaul**, and **(3) 3 focused milestone options** tuned to your “Phase 3: RC love” vision (chat-style activity + commands, modern layout, file manager first pass).

---

# 1) Codebase breakdown (high-signal)

**Top-level**

- `server/` — Node/TS authoritative shard server
  - Key: `src/WebSocketServer.ts`, `AdminServer.ts`, `PermissionChecker.ts`, `OwnershipStore.ts`, `Logger.ts`, `AuditLog.ts`, `WorldMap.ts`, `AccountStore.ts`, `types.ts`, `MosaicAuthClient.ts`, `RateLimiter.ts`, `PersistenceService.ts`, `DatabaseService.ts`, `ConfigService.ts`, `index.ts`
- `rc/` — Avalonia RC desktop app
  - `Mosaic.RC/` project: `RCNetworkClient.cs`, `Protocol.cs`, `MosaicAuthClient.cs`, Views (`MainWindow.axaml`, `MainWindowView.axaml`, `RootWindow.axaml`, `LoginView.axaml`, `ShardSelectView.axaml`), ViewModels (`MainWindowViewModel.cs`, `RootViewModel.cs`, `ShardSelectViewModel.cs`), Controls (`MapCanvas.cs`)
  - `design-wireframe.md` (nice anchor to drive the redesign)
- `client/` — MonoGame client
  - Core: `NetworkClient.cs`, `Protocol.cs`, `MosaicAuthClient.cs`, `Screens/*` (Login/ShardSelection), `UI/*`
- `orchestrator/` — shard creation/automation
  - `src/ShardOrchestrator.ts`, `helpers.ts`, `index.ts`
- `schemas/`, `docs/`, `shards/`, `tools/` — support & docs

---

# 2) RC overhaul extension points (server + RC)

### Server (new/updated handlers & safety)

- **Protocol & routing**
  - `server/src/types.ts` — add RC message shapes:
    - `rc_chat_send`, `rc_chat_event` (broadcast+server activity feed)
    - `rc_command` (slash command envelope)
    - `rc_file_list`, `rc_file_upload_chunk`, `rc_file_download`, `rc_file_move`, `rc_file_rename`, `rc_file_delete`, `rc_mkdir`
  - `server/src/WebSocketServer.ts` — route RC channel messages
  - `server/src/AdminServer.ts` — implement handlers (role checks, rate-limit, audit)
- **Auth & permissions**
  - `PermissionChecker.ts`, `OwnershipStore.ts`, `AccountStore.ts`
    - Add **role gates**: owner-only: staff mgmt; admin: chat/mod commands; all RC users: read-only activity feed
- **Audit & rate limits**
  - `AuditLog.ts`, `Logger.ts`, `RateLimiter.ts`
    - Log admin actions (kick/ban/file ops), throttle chat/commands (e.g., 5 msgs/10s)
- **File-system sandbox**
  - New small module or inside `AdminServer.ts`: canonicalize paths, **deny traversal**, whitelist extensions, size caps, chunked upload, safe overwrite policy
- **Fanout**
  - RC-to-RC broadcast (all authenticated RC sessions for the shard) + server events → `rc_chat_event`

### RC (UI, VM, protocol)

- **Protocol & transport**
  - `Mosaic.RC/Protocol.cs`, `RCNetworkClient.cs` — add message structs & send/receive for chat/commands/files; reconnect & role capability flags in login ack
- **New UI panels**
  - **Ops Chat** (scrolling chat-style activity feed + input): new views (e.g., `OpsChatView.axaml(+.cs)`), VM (e.g., `OpsChatViewModel.cs`) with bindable `ObservableCollection<ChatItem>`
  - **File Manager v1**: `FileManagerView.axaml(+.cs)` with TreeView + context menu; drag/drop surface; progress toasts
- **Shell/layout**
  - `MainWindowView.axaml`, `MainWindowViewModel.cs` — introduce a panes layout (e.g., left: file tree; center: map/“workspace” tabs; right: players/logs optional; bottom: Ops Chat)
  - “**Button area**”/toolbar with placeholder **Code Manager** button (non-functional for now), plus toggles (Paint Mode if needed), and a **Commands** quick dropdown (slash help)

---

# 3) Milestone options (pick order; all scoped for quick wins)

## A) **Ops Chat & Activity Feed (role-aware)**

Make the RC “come alive” and unify human chat + server activity in one pane.

**Why first:** immediate UX upgrade, shared presence for staff, lays the command bus you want (slash or UI-driven), minimal blast radius.

**Scope**

- Server:
  - `rc_chat_send` (text) → validate (role, length, rate), broadcast `rc_chat_event`
  - Emit `rc_chat_event` for **server activity** (joins/leaves, admin_feedback, errors) with tags (`system`, `warn`, `error`, `moderation`, `build`)
  - `rc_command` handler (foundation): parse `/kick`, `/ban`, `/announce` (owner/admin only), return `admin_feedback`
  - Wire to `AuditLog` (who did what, when)
- RC:
  - **Ops Chat panel**: virtualized list (no UI thrash), time + role badge + source (user/server), filter toggles (system/chat/errors)
  - Input box with slash-hints; Enter to send; ctrl-enter multiline
  - Command help palette (press `/` to open), but **don’t** hardcode full command grammar—let server return capabilities/help
- Safety:
  - Rate-limit on server (per-account, per-IP), basic profanity toggle optional (future)
  - Max message length (e.g., 512), markdown-lite sanitization

**Acceptance**

- Two RCs connected: messages echo; server activity streams live; `/announce` works; permissions enforced; audit lines appear.

---

## B) **File Manager v1 (safe, practical, DnD-friendly)**

Creator needs: **list / upload / download / rename / move / delete / mkdir** with a **real sandbox**.

**Scope**

- Server:
  - FS root = shard content root; all ops path-normalized; extension whitelist; size limit (config)
  - Uploads: chunked with simple protocol (`start` → `chunk` → `commit`/`abort`), checksum optional (v2)
  - Moves/renames: atomic where possible; deny cross-root
  - Directory listing (lazy): return tree for first N levels; child fetch on expand
- RC:
  - Left pane **TreeView**: expand/collapse; context menu actions; toolbar with Upload/Refresh
  - Drag-drop from desktop → upload; in-tree drag to move
  - Progress UI & error toasts; double-click to **open** known types (TS in editor pane later; for now, download or view raw)
- Safety:
  - Role check: owner/admin write; viewer read-only (if you allow read-only RC)
  - Server logs each write op to `AuditLog` with actor & hash/size

**Acceptance**

- Upload PNG/TS, see it appear; rename/move works; path traversal blocked (`../`); large file rejected; audit recorded.

---

## C) **RC Shell & Layout Revamp (+ Code Manager placeholder)**

Give the RC a modern, **stable pane layout** to house chat, file manager, map canvas, and future code/editor tabs.

**Scope**

- Introduce a **docked layout**:
  - Left: **File Manager**
  - Center: **Workspace Tabs** (MapCanvas tab + future Code Editor tabs)
  - Right (optional): **Players / Inspector**
  - Bottom: **Ops Chat & Activity**
  - Top: Toolbar (“Code Manager” button (placeholder), “Players”, “Settings”, “Reconnect”)
- Theme polish:
  - Consistent padding/spacing, 2xl rounded cards, soft shadows, high-contrast log badges
  - Keep virtualization to avoid 30Hz presence flicker; selection stable during updates
- Wiring:
  - `MainWindowView.axaml` and `MainWindowViewModel.cs`: new composable regions
  - Add ViewModels for new panels with DI-friendly structure
- Add “**Code Manager**” toolbar button (no-op + tooltip: “Coming soon: DB NPCs, Weapons, Level NPCs, Classes browser”)

**Acceptance**

- RC boots into new layout; panels resize; no flicker with live updates; MapCanvas still works; chat and file manager panels place nicely.

---

## Recommended order

Given your vision (“chat-centric” ops & full revamp), I’d do:

1. **C — Shell & Layout Revamp** (smallest viable shell + Ops Chat placeholder dock)
2. **A — Ops Chat & Commands** (lights up the bottom pane, gives team comms + activity feed)
3. **B — File Manager v1** (now that shell exists, panel UX is straightforward)

If you prefer immediate function over layout, swap 1/2 (do A → C → B).

---

## Repo touchpoints (expected)

- **Server:** `types.ts`, `WebSocketServer.ts`, `AdminServer.ts`, `PermissionChecker.ts`, `AuditLog.ts`, `Logger.ts`, add `FsSandbox` helper (or inline safely)
- **RC:** `Protocol.cs`, `RCNetworkClient.cs`, `MainWindowView.axaml`, `MainWindowViewModel.cs`, new `OpsChatView(.axaml/.cs)`, `OpsChatViewModel.cs`, `FileManagerView(.axaml/.cs)`, `FileManagerViewModel.cs`, small updates to `RootWindow.axaml`, `ShardSelectView.axaml`
- **Docs:** `rc/README.md`, `docs/CONTENT_PIPELINE.md` (upload limits), add `docs/RC_OPS_CHAT.md`, `docs/RC_FILE_MANAGER.md`

---

If this direction looks right, tell me which milestone to lock first (or reorder), and I’ll generate a **ready-to-paste Claude Code task** using our framework—tight scope, role checks, safety notes, and an actionable validation plan.
