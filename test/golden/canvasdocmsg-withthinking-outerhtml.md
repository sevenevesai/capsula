# Fixture

**Model**: gpt-5-thinking
**Version**: ChatGPT Export v1.5.0

---

## ChatGPT

*Thought for 18s*

*5) Working Rules for You (the model)*

*[Expandable content available]*

**Canvas Artifact**: Mosaic → Claude Code Prompt Framework (document)

---

# Mosaic → Claude Code Prompt Framework (for Claude Code / repo-aware coder models)

> Purpose: a reusable, copy‑paste prompt you can adapt each session to steer a repo‑aware coding model without micromanaging implementation details. It sets scope, guardrails, and deliverables while letting the model decide **how**.

## 0) Session Goal (fill me in 1–2 sentences)

**Objective:** 
**Why now:**

## 1) Project Context (quick, factual)

- **Project:** Mosaic — authoritative multiplayer game engine + RC (live-ops / editor) + clients.
- **Key pieces:**
  - **Server** (Node/TS): authoritative sim, WebSocket API, admin commands, map persistence, auth.
  - **RC** (Avalonia/.NET): live world tooling, presence/logs, map canvas, admin actions.
  - **Game Client** (MonoGame/.NET): connects to server, renders world, handles input.
- **Recent changes:** security/auth upgrade, health checks, env‑driven ports, persistent map editing (see repo docs).

> If specifics matter, the model should **discover them from code/docs first**, not guess.

## 2) Constraints & Guardrails (don’t break these)

- **Authority:** Server is source of truth; clients never author authoritative state.
- **RBAC:** Admin‑only commands must be validated server‑side; no client‑side trust.
- **Config:** No hardcoded ports/hosts; use env/ConfigService with sensible defaults.
- **Back-compat:** Avoid breaking existing message types unless versioned; prefer additive changes.
- **Persistence:** Map + spawn + settings must round‑trip on save/load.
- **Performance:** Steady 30 TPS sim; avoid UI thrash in RC (diffed updates, throttle where needed).
- **Cross‑platform:** Windows + macOS builds for client/RC when feasible; avoid OS‑specific hacks.
- **Logging:** Use central Logger (levels, JSON mode); emit actionable admin_feedback.

## 3) What to Read First (model should scan before proposing)

- **Server:** `server/src/ConfigService.ts`, `server/src/WebSocketServer.ts`, `server/src/types.ts`, `server/src/WorldMap.ts`, `server/src/Logger.ts`, `server/src/HealthCheckServer.ts`.
- **RC:** `rc/Mosaic.RC/*` focusing `MapCanvas`, `MainWindow(ViewModel).cs`, `RCNetworkClient.cs`, UI/XAML layout.
- **Client:** `client/Mosaic.Client/*` focusing connection boot, `NetworkClient.cs`, `Protocol.cs`.
- **Docs:** `README.md` files, `VISUAL_EDITOR_*`, `DELIVERY_SUMMARY.md`, `.env.example`.

> Use these as **likely** paths; confirm by reading the repo—names may vary. If different, adapt and cite the real files in your plan.

## 4) Output Format — every reply must follow this structure

1. **Plan (short):** numbered steps from discovery → design → implementation → validation → docs → delivery.
2. **Repo Touchpoints (guessed, to be verified by you):** list of files/dirs you expect to modify or create.
3. **Protocol/API surface:** any new/changed message types, payloads, or HTTP endpoints (schemas only).
4. **Risks & Mitigations:** top 3 risks and how you’ll guardrail them.
5. **Validation Plan:** manual test matrix + any quick unit/integration tests you will add.
6. **Deliverables Checklist:** code, docs, scripts, build outputs; include expected command lines.
7. **Diff Preview (summary):** high‑level description of changes (no giant code dumps; show key signatures/snippets only when clarifying).

> Keep the body focused. Show **what** and **why**; implement **how** in code PRs/patches inside the repo.

## 5) Working Rules for You (the model)

- **Discover before designing:** read code/docs first; summarize what exists; then propose.
- **Minimize blast radius:** prefer additive, feature‑flagged, or opt‑in changes; preserve defaults.
- **Name things clearly:** new types/messages/components must be self‑descriptive and documented where they live.
- **Don’t invent facts:** if unsure, list assumptions explicitly and gate changes behind config.
- **Keep envs tidy:** use `.env.*` + `ConfigService`; no hardcoded `localhost:3000/4000` in code.
- **Instrumentation:** add logs/metrics where changes are non‑obvious; keep logs concise.
- **Docs with code:** when you change behavior, update the nearest README/QUICK_REFERENCE and add a CHANGELOG line.
- **Commits/PRs:** small, well‑scoped commits with imperative subjects; PR description mirrors the **Output Format** above.

## 6) Definition of Done (DoD)

- All acceptance tests in **Validation Plan** pass locally.
- Cold start from clean checkout works (document exact commands).
- Configurable via env with sane defaults; no secret values in repo.
- RC continues to display presence/world updates smoothly (no selection reset, no flicker).
- Server maintains 30 TPS without regressions in logs.
- Map edits + spawn persist across restart when saved.
- Docs updated and linked; example commands verified.

## 7) Task Template (paste this and fill the <> slots)

TASK: <short title>

Context Recap:
- Goal: <desired outcome in 1 sentence>
- User impact: <who benefits and how>
- Non-goals: <what we’re explicitly not doing>

Deliverable Expectations (follow Output Format §§4):
- Implement the minimal viable changes to achieve the goal without breaking authority, RBAC, or persistence.
- Surface any protocol additions as schemas; keep them additive.
- Ensure env-driven configuration; no hardcoding.
- Include validation steps we can run locally.

Repo Orientation:
- Start by reading: <list a few likely files/dirs>
- Related docs: <relevant docs>

Constraints:
- TPS budget and UI smoothness must not regress.
- Backwards compatibility unless versioned.

Acceptance Criteria (quick bullets):
- <AC #1>
- <AC #2>
- <AC #3>

Output Required:
- Plan, Repo Touchpoints, Protocol/API surface, Risks, Validation Plan, Deliverables Checklist, Diff Preview.

## 8) Example Task A — Client Auth Handshake & Dev/VPS Switch (ready to paste)

TASK: Stabilize client auth handshake + seamless dev/VPS server switching

Context Recap:
- Goal: Ensure clients connect via the new auth flow and can target either local dev or remote VPS without code changes.
- User impact: Fewer connection failures; easier sharing test builds.
- Non-goals: Rewriting auth service or adding new crypto; keep it within existing model.

Deliverable Expectations:
- Diagnose current client → auth → game server boot path; summarize actual flow from code.
- Make server URIs/env robust (no hardcoded localhost); support ws/wss and separate auth/base URIs.
- Provide a tiny “connection profile” mechanism (env or config file) to switch between `DEV` and `VPS`.

Repo Orientation:
- Read first: client `NetworkClient.cs`, `Protocol.cs`; server `ConfigService.ts`, `WebSocketServer.ts`, `types.ts`; any auth module; RC `RCNetworkClient.cs` for reference.
- Docs: `.env.example`, auth/security notes.

Constraints:
- Authority & RBAC unchanged; additive config only.

Acceptance Criteria:
- Client can connect to **DEV** (localhost) and **VPS** (provided ws://host:port) by switching a config value or CLI flag.
- On bad auth host/port, user sees a clear error (no generic “killed”).
- Session tokens stored/read in a cross‑platform path; add a “clear session” command/option.

Output Required: per §4.

## 9) Example Task B — RC Tile Palette + Spawn Editing (guidance, not step-by-step)

TASK: RC tile palette, brush painting, and spawn editing with persisted spawn

Context Recap:
- Goal: Upgrade RC from numeric edits to creator‑friendly painting and allow setting spawn in‑world.
- User impact: Faster world building; demo‑ready tooling.
- Non-goals: Complex tools (fill/rectangle), AI/NPC systems, new collision model.

Deliverable Expectations:
- Add a selectable palette with a small, hardcoded set of tile IDs/styles (model may propose where to centralize mapping).
- Introduce a Paint Mode (click and optional drag) that sends admin tile edits with throttling/deduping.
- Add a “Set Spawn Here” action that updates in‑memory spawn and persists on save; surface admin_feedback.

Repo Orientation:
- Read: RC `MapCanvas`, ViewModel, `RCNetworkClient`; server `types.ts`, WebSocket handling, `WorldMap` save/load.
- Docs: `VISUAL_EDITOR_*`, RC README.

Constraints:
- Keep server authoritative; add admin validation; preserve 30 TPS; avoid UI thrash.

Acceptance Criteria:
- Palette selection visible; Paint Mode toggle; painted tiles replicate instantly to clients.
- Spawn can be set from RC; new connections use it; persists after save+restart.
- Docs updated; quickstart steps verified.

Output Required: per §4.

## 10) Quality Bar & PR Hygiene

- **Testing:** include a manual test script and at least one small unit/integration test where practical.
- **Builds:** verify Windows and macOS client builds still launch; note any platform‑specific steps.
- **Telemetry:** emit clear logs for new code paths; keep noise down.
- **Docs:** keep close to the code; short and practical.
- **Rollback:** changes should be revertible without data loss.

## 11) Handy Snippets (to reuse in tasks)

- **Assumptions block:** “Assumptions I’m making to proceed…”
- **Out of scope block:** “Explicitly not doing…”
- **Config note:** “All new settings are env‑driven with defaults; documented in `.env.example`.”
- **Performance note:** “UI updates diffed; no selection flicker; throttle ≤30Hz where needed.”

### How to use this

1. Duplicate §7 **Task Template** for each new request.
2. Fill the angled‑bracket fields.
3. Paste to Claude Code as your whole message (or prepend §0–3 if fresh context is helpful).
4. Expect its reply to strictly follow §4 Output Format.
