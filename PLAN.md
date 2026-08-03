# LLMWebChat — Build Plan & Status

> Living plan doc. Architecture & vision live in [DESIGN.md](./DESIGN.md); competitive research in [RESEARCH.md](./RESEARCH.md). This file tracks **what's built, what's next, and how we ship each phase.**

---

## Decisions (locked)
1. **Provider-agnostic** — one OpenAI-compatible client speaks to Ollama, LM Studio, OpenRouter, or any custom endpoint. (z.ai was evaluated and **excluded** — its GLM Coding Plan ToS limits use to supported coding tools, not a general web chat. Any user can still add it as a custom provider at their own risk.)
2. **Proxy server included** — holds secrets, hosts tools/MCP/RAG/code-sandbox, serves the SPA in production.
3. **Frontend** — Vite + React SPA (PWA-first, Tauri-wrappable later — *deferred, not ruled out*).
4. **Name** — **LLMWebChat**.
5. **Scope** — full-agentic: tools, web search, code interpreter, MCP, browser agent, RAG.
6. **Users** — single-user for now (multi-user/collaboration is a later phase).

## 🔒 Security posture (done)
The proxy holds secrets and executes tools, so hardening came first:
- binds **127.0.0.1** only (opt-out via `LLMWEBCHAT_HOST`)
- CORS allowlist of local origins (CSRF defence) + optional bearer-token gate
- body-size cap + per-IP rate limit on `/api/chat`
- chat route validates provider/model/messages and caps rounds
- tools sandboxed: SSRF guard (private/loopback/metadata blocked), path-traversal guard, sanitized env for subprocesses
- `run_bash` and `write_file` are **off by default**

---

## ✅ Phase 0 — Foundation (DONE)
- [x] pnpm monorepo: `packages/{shared,providers}`, `apps/{server,web}`
- [x] `@llmwebchat/shared` — types: `ProviderConfig`, `ChatMessage`, `Conversation`, `Settings`, `ChatEvent`, `ToolDef`, `PROVIDER_PRESETS`, `defaultSettings()`
- [x] `@llmwebchat/providers` — fetch-based OpenAI-compatible streaming client; SSE parsing; z.ai `reasoning_content` + `reasoning` normalisation; tool-call fragment handling; `listModels()`
- [x] `@llmwebchat/server` — Hono proxy:
  - [x] `/api/health`, `/api/settings` (GET masked / PUT with key-preservation), `/api/models`, `/api/chat` (NDJSON streaming)
  - [x] file-backed settings store with env seeding (`ZAI_API_KEY`, `OLLAMA_BASE_URL`)
  - [x] agentic loop scaffold (multi-round tool calling) + tool registry
  - [x] static SPA serving from `web-dist` in production
- [x] `@llmwebchat/web` — chat UI:
  - [x] streaming message rendering, collapsible **reasoning** panel, tool-call/result cards
  - [x] Markdown + GFM + KaTeX + highlight.js (copy-able code blocks)
  - [x] conversation sidebar (new/select/delete/rename), persisted to localStorage
  - [x] composer: model/provider pickers, reasoning-effort selector, tools toggle, stop button
  - [x] settings modal: add/edit/remove providers, API keys (masked), active provider
- [x] **Verified end-to-end** with real GLM-4.6: `start → reasoning → delta → finish` lifecycle confirmed.

### Known polish items (Phase 0.5)
- [ ] System prompt from settings is not yet injected into the request
- [ ] `LLMWEBCHAT_DATA_DIR` propagation check / docs
- [ ] Code-split the vendor bundle (824 KB → split markdown/katex)
- [ ] Empty-state suggestion buttons call `send()` without awaiting a created conv (minor race)
- [ ] Add a real `pnpm dev` root script that boots both apps cleanly + prints URLs

---

## 🚧 Phase 1 — Power UX
- [ ] **Conversation branching/forking** — `parentId` is already on every message; build the tree view + "branch from here" action + active-path walk
- [ ] **Command palette** (⌘K) — switch chat, set model, toggle tools, jump to settings
- [ ] **Keyboard shortcuts** — new chat, search, cycle model, branch, stop/regenerate
- [ ] **Vim input mode** in the composer
- [ ] Message actions: regenerate, edit-and-resubmit, copy, branch
- [ ] Full-text **search** across conversations
- [ ] Folders / pinning in sidebar

## 🎨 Phase 2 — Artifacts & rendering
- [ ] **Artifact side panel** — multi-tab live render: code / HTML / React / SVG / Mermaid
- [ ] **Code interpreter** — Pyodide (Python) + WebContainers (Node) "Run" buttons, output capture
- [ ] Inline charts (Recharts), data tables, generative-UI cards
- [ ] File & image **upload** (multimodal) — wire `Attachment` → provider image_url parts
- [ ] Streaming artifact detection (model emits fenced block → opens panel)

## 🔌 Phase 3 — Agentic layer
- [ ] Built-in tools: `web_search`, `web_reader`, `read_file`, `write_file`, `run_bash` (sandboxed)
- [ ] **MCP client** — connect MCP servers (filesystem, browser, z.ai search/reader/vision MCP)
- [ ] z.ai native tools wired as MCP-style tools (web-search, image-gen, OCR endpoints)
- [ ] **RAG / project knowledge** — embed docs, hybrid search (BM25 + vector) + rerank, `#`-inject
- [ ] Tool-call execution visualisation + human-in-the-loop approvals
- [ ] Browser agent (Playwright) — optional, high-power

## 🌟 Phase 4 — Differentiators
- [ ] **Multi-model arena** — n models answer side-by-side, A/B vote, export winner
- [ ] **Conversation-tree graph** view + branch diffing/merging
- [ ] **Voice mode** — STT (Whisper.cpp / z.ai GLM-ASR) + TTS streaming, push-to-talk
- [ ] **Prompt/agent library** — templates with variables, shareable presets
- [ ] Theming system (import/export), **PWA** install + offline
- [ ] **Tauri** desktop wrapper (resurrect decision #3)

## 👥 Phase 5 — Multi-user (optional, later)
- [ ] Auth (Better-Auth/Lucia), backend-backed conversation storage & sync
- [ ] Shared agents / channels (OpenWebUI-style collaboration)
- [ ] Usage analytics + model evaluation arena

---

## Tech stack (as built)
| Layer | Choice |
|---|---|
| Monorepo | pnpm workspaces |
| Frontend | Vite 6 + React 19 + TypeScript + Tailwind CSS v4 |
| Markdown | react-markdown + remark-gfm + rehype-katex + rehype-highlight |
| State | Zustand (persist → localStorage) |
| Proxy | Hono + @hono/node-server (Node) |
| Streaming | raw fetch + SSE, NDJSON over HTTP |
| Execution (planned) | Pyodide + WebContainers |

## How to add a feature (convention)
1. Types that cross the HTTP boundary → `packages/shared`
2. Provider/transport logic → `packages/providers`
3. Server-side trust/execution/secrets → `apps/server` (route + register in `src/index.ts`)
4. UI → `apps/web/src/components`
5. Run `pnpm typecheck` then `pnpm build` before committing.
