# LLMWebChat → "Forge" — Agent Studio Master Plan

> **Mission:** Stop being "a chat with an agent toggle." Become the **polished, local-first agent studio** — the beautiful GUI front-end for pi (and any local/cloud LLM). The thing people open instead of a terminal. Bolt.new's polish × Cursor's agentic depth × OpenClaw's multi-backend reach, but **yours, private, on your machine.**

This is a *plan*, not code. Read it, react to it, then we build.

---

## 1. The honest problems (what you just hit)
1. **Blank dropdown = dead end.** No model → empty `<select>` → user stares at nothing. **Never allowed.** Every empty state must speak: "No model selected — click to set one up" with a one-tap fix.
2. **The UI is utilitarian, not lovable.** Dense, gray, no hierarchy, no delight. It *works*; it doesn't *wow*.
3. **Pi is a hidden toggle**, not the hero. The agent's power (live file edits, diffs, bash, plans) is invisible — buried as text in a chat bubble.
4. **Setup is friction.** Wiring the local LLM to the agent means hand-editing JSON. Grandmas don't edit JSON.

## 2. The new concept: a 3-pane **Agent Studio**
Today: sidebar + chat. Tomorrow: a real **workspace** — like an IDE built around the agent.

```
┌─────────────┬──────────────────────────────┬─────────────────────┐
│ Sessions    │  Conversation + Activity     │  Workspace (tabs)   │
│ ─────────   │  ─────────────────────────   │  ─────────────────  │
│ + New       │  you: refactor auth.ts       │  📁 Files   ✏ Diff  │
│ ▸ bug-fix   │                              │  📐 Plan   🖥 Term  │
│ ▸ feature X │  🤖 agent · on llama-cpp     │                     │
│  (pinned)   │  ▸ 📐 Plan (3/5) ✓✓○○○      │  src/               │
│ ▸ research  │  ▸ ✏️ edit auth.ts  [diff]   │   ├ auth.ts  ●edited│
│             │  ▸ 🖥 bash: npm test         │   ├ login.ts        │
│ tags: #api  │      ├ PASS (12)             │   └ utils/          │
│ #refactor   │  ▸ ✏️ edit login.ts [diff]   │  [accept all] [review]│
│             │  ▸ ✓ Done. 3 files changed.  │                     │
│ ─────────   │                              │  ─ pending diff ─   │
│ ⚙ settings  │  [composer: 🤖 agent ON]     │  auth.ts  +12 -3    │
│ 🤖 llama-cpp│                              │  [view] [accept] [✕]│
└─────────────┴──────────────────────────────┴─────────────────────┘
```

- **Left:** sessions (pi sessions + plain chats), tags, pinned, search, current backend badge.
- **Center:** the conversation, but agent turns are **rich cards** — Plan, File-edit-with-diff, Bash-with-output, Web-fetch, Reasoning — each approvable inline.
- **Right (the magic):** a live **Workspace** panel with tabs: **Files** (live tree of the agent's cwd), **Diff** (pending edits, accept/reject), **Plan** (checklist), **Terminal** (streaming bash). This is what makes it feel like a real agent, not a chat.

## 3. Design system rework (the "looks nice" fix)
A real design language, not ad-hoc Tailwind:
- **Type:** Inter (UI) + JetBrains Mono (code), proper type scale.
- **Color:** refined near-black canvas, layered surfaces, ONE accent (already themeable), semantic colors (success/warn/danger) used consistently.
- **Density:** generous spacing, clear hierarchy, rounded 12–14px, soft shadows, 1px hairline borders.
- **Components:** a small polished kit — Button (variants), Card, Pill/Badge, Tooltip, Toast, Modal, EmptyState, Skeleton. Consistent everywhere.
- **Delight:** streaming caret, smooth tool-card expand, micro-animations on accept/reject, a tasteful empty-state illustration set.
- **Light + dark**, both designed (not auto-inverted).

Goal: when you open it, it should feel like a *product*, not a dev prototype.

## 4. Kill every blank state — guided onboarding
A **first-run wizard** (and resilient defaults after):
1. **"Pick your engine"** — big friendly cards: 🦙 **llama.cpp** · 🐪 **Ollama** · ☁️ **Cloud (OpenRouter/Anthropic/etc.)** · 🤖 **"Use my pi config"** (zero setup).
2. **Auto-detect & connect** — we ping the server, show ✓/✗, offer the exact fix ("Start Ollama", "Pull llama3.2", "Paste your key").
3. **"What should the agent call this model?"** — never an empty dropdown; default to a discovered/preset name with a clear "No model selected → choose" affordance.
4. **Pick a workspace folder** for the agent (or skip).
5. **Try your first prompt** — pre-filled examples.

Every subsequent empty state (no chats, no files, agent off, no model) gets the same treatment: **a sentence + a single obvious action.**

## 5. Deep pi integration (the "more advanced" part)
Pi already runs as our agent backend. Surface its real power in the UI:
- **Plan mode** — pi's plan as a live checklist you can approve step-by-step.
- **Live diffs** — pi's `edit`/`write` tool calls render as **unified diffs** in the Workspace; accept/reject before they're final (pi writes files; we show the change + can revert).
- **Bash terminal panel** — streaming stdout/stderr, exit codes, stop button.
- **File tree** that updates as pi edits (watch the cwd).
- **Approvals** — destructive ops pause for one click (already prototyped; make it beautiful).
- **Skills & extensions** — a picker to invoke `/skill:...`, `/plan`, manage MCP servers, all from the UI.
- **Session branching** — pi sessions are trees; visualize + fork like we already do for chats.
- **Compaction, memory, model-switch** — first-class controls, not buried.
- **Reasoning stream** — gorgeous collapsible "thinking" with effort slider.

## 6. Local-LLM-first, zero-JSON
- **One-click "Agent on my local LLM"**: pick llama.cpp/Ollama in the UI → the proxy **writes the pi `models.json` provider for you** (correct `compat` flags included) and points the agent at it. No hand-editing. Reverses to cloud anytime.
- Auto-detect running servers (llama.cpp :8080, Ollama :11434, LM Studio :1234) and offer them.
- Honest model-capability hints ("this model may struggle with tool-use — try a coder model").

## 7. The "grand" differentiators (creative swings)
- **🌬️ Breath / Steering** — mid-task, type to *steer* the agent (pi supports `steer`/`follow_up`). A floating "steer" bar appears while the agent works.
- **🔁 Replay** — scrub through an agent run like a video (every tool call, every diff) and branch from any point.
- **🎯 Goals → Tasks** — drop a big goal, the agent decomposes into a plan you edit, then executes with live progress.
- **🧩 Agent presets** — "Code Reviewer", "Bug Hunter", "Doc Writer" — bundles of system prompt + skills + tools, shareable.
- **📡 Multi-agent watch** — run 2 agents on a task, watch both think side-by-side (extends our Arena).
- **🏠 Home dashboard** — recent sessions, pinned projects, quick-start presets; the "open the app and feel oriented" screen.
- **🎮 Command palette on steroids** — ⌘K does *everything*: switch session, run skill, set model, jump to file, trigger a preset.
- **📱 Native-feel** — PWA + later Tauri, global hotkey to summon (like Spotlight).

## 8. Build plan (phased, each phase ships something visibly better)

**Phase A — Foundations of delight (days 1–2)**
- Design tokens + component kit (Button/Card/Pill/Toast/EmptyState/Skeleton).
- Kill blank states: "No model selected" everywhere; model dropdown shows CTA.
- First-run onboarding wizard.
- Rework chat thread aesthetics (bubbles, code blocks, reasoning panel).
- Toasts for errors/success.

**Phase B — The Workspace (days 3–5)**
- Right pane: **Files** (live tree of agent cwd), **Diff** (pending edits, accept/reject), **Terminal** (bash streaming), **Plan** (checklist).
- Rich agent tool-cards in the thread (diff card, bash card, plan card).
- Wire pi events → these panels (we already stream pi events; route them to UI surfaces).

**Phase C — Pi depth (days 6–8)**
- Plan mode + step approvals, steering bar, session branching viz, skills/extensions picker.
- One-click local-LLM agent setup (auto-write pi models.json).

**Phase D — Grandeur (days 9+)**
- Replay, agent presets, multi-agent watch, home dashboard, Tauri shell.

## 9. Immediate no-brainers (do first, regardless of scope)
- Model picker: empty → **"No model selected — choose…"** (never blank).
- Provider-down banner is good; make the **fix a button**, not just text.
- A real **loading/skeleton** while settings/models load.
- Rename/rebrand pick (see below).

## 10. Open decisions for you
1. **Name:** "LLMWebChat" is forgettable. Candidates: **Forge**, **Atelier**, **Pi Studio**, **Nova**, **Hearth**, **Loom**. Pick one or give me a direction.
2. **Scope of v2:** all-in on the 3-pane Studio, or keep chat-centric and layer the Workspace as an optional panel?
3. **Local-first purity:** local-LLM-only by default, or local-first but cloud-friendly (current)?
4. **Look direction:** "Linear/v0 clean" (minimal, sharp) vs "Bolt/playful" (warm, gradient) vs "IDE/serious" (Cursor, dense).

---

**TL;DR:** Rebuild the surface as a polished **Agent Studio** — guided onboarding (no blank states), a real design system, and a live **Workspace** (files/diffs/terminal/plan) that makes the pi agent's work *visible and controllable*. Local-LLM-first, one-click setup, zero JSON. Phase A starts with design + killing blank states.
