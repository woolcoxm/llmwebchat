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
- [x] **Verified end-to-end** with a real OpenAI-compatible model: `start → reasoning → delta → finish` lifecycle confirmed; agentic tool loop (web_search) confirmed.

### Phase 0.5 polish (done)
- [x] System prompt injected server-side when no system message present
- [x] `LLMWEBCHAT_DATA_DIR` + `LLMWEBCHAT_HOST` + `LLMWEBCHAT_AUTH_TOKEN` env handling
- [x] Root `pnpm dev` boots both apps; production SPA served from any cwd (fixed)
- [ ] Code-split the vendor bundle (mermaid/pyodide already lazy; markdown/katex still in main chunk)

---

## ✅ Phase 1 — Power UX (mostly done)
- [x] **Conversation branching/forking** — tree model (parentId + activeChild), active-path walk, regenerate, edit-and-resubmit, branch navigation (1/n prev/next)
- [x] **Command palette** (⌘K) — fuzzy, arrow/enter nav, all key actions
- [x] **Keyboard shortcuts** — ⌘K palette, ⌘B sidebar, ⌘J artifacts, ⌘, settings, ⌘N new, ⌘. stop
- [x] Message actions: regenerate, edit-and-resubmit, copy, branch nav
- [x] Full-text **search** across conversations (title + message content)
- [ ] Vim input mode in the composer
- [ ] Folders / pinning in sidebar

## ✅ Phase 2 — Artifacts & rendering (core done)
- [x] **Artifact side panel** — multi-tab: Source / live Preview / Run; HTML (sandboxed iframe) / SVG / Mermaid (lazy)
- [x] **Code interpreter** — Pyodide (Python, WASM-sandboxed) lazy-loaded from CDN, stdout captured
- [ ] Inline charts (Recharts), data tables, generative-UI cards
- [ ] File & image upload (multimodal) — wire `Attachment` → provider image_url parts
- [ ] Streaming auto-open of artifact panel on fenced blocks

## 🔌 Phase 3 — Agentic layer (tools done; MCP/RAG pending)
- [x] Built-in tools: `web_search`, `web_reader`, `read_file`, `write_file`, `run_bash` — sandboxed + settings-gated
- [x] Tool-call/result rendering in the message stream; tools config UI in Settings
- [ ] **MCP client** — connect MCP servers (filesystem, browser, etc.)
- [ ] **RAG / project knowledge** — embed docs, hybrid search + rerank, `#`-inject
- [ ] Human-in-the-loop approvals for destructive tools
- [ ] Browser agent (Playwright) — optional

## 🌟 Phase 4 — Differentiators (partial)
- [ ] **Multi-model arena** — n models side-by-side, A/B vote
- [ ] Conversation-tree graph view + branch diffing
- [ ] Voice mode (STT/TTS)
- [ ] Prompt/agent library
- [x] Command palette + global shortcuts (moved from Phase 1)
- [ ] Theming system, PWA install + offline, Tauri desktop

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
