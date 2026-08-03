# LLMWebChat

> An advanced, provider-agnostic LLM web chat interface. z.ai GLM + local models, full-agentic, local-first with a secrets-holding proxy.

**Status:** Phase 0 (foundation) — streaming chat to GLM and any OpenAI-compatible endpoint is working end-to-end. See [PLAN.md](./PLAN.md) for what's built and what's next, [DESIGN.md](./DESIGN.md) for architecture, and [RESEARCH.md](./RESEARCH.md) for the competitive analysis it's based on.

---

## ✨ What's here now
- **Provider-agnostic** — z.ai, Ollama, OpenRouter, LM Studio, or any custom OpenAI-compatible URL, all behind one client
- **Reasoning stream** — GLM deep-thinking (`reasoning_content`) rendered in a collapsible panel, with per-message effort control (`max → none`)
- **Agentic loop scaffold** — multi-round tool calling is wired in (tools land in Phase 3)
- **Secrets stay in the proxy** — API keys never reach the browser; the server masks them
- **Rich rendering** — Markdown + GFM + KaTeX (math) + syntax-highlighted, copy-able code blocks
- **Conversation history** — sidebar with create/select/rename/delete, persisted in the browser
- **Graceful offline** — local runners (Ollama) with live `/models` discovery and preset fallback

## 🧭 Roadmap (high level)
| Phase | Theme |
|---|---|
| ✅ 0 | Foundation — streaming chat, settings, providers |
| 🚧 1 | Power UX — branching/forking, command palette, keyboard, search |
| 🎨 2 | Artifacts & rendering — live panels, in-browser code interpreter |
| 🔌 3 | Agentic — tools, MCP, RAG/knowledge, web search, browser agent |
| 🌟 4 | Differentiators — multi-model arena, voice, prompt library, PWA/Tauri |
| 👥 5 | Multi-user (optional) |

---

## 🏗️ Architecture
```
packages/
  shared/      types crossing the HTTP boundary (+ provider presets)
  providers/   fetch-based OpenAI-compatible streaming client (SSE + reasoning)
apps/
  server/      Hono proxy: secrets, /api/chat (NDJSON stream), models, settings, tools
  web/         Vite + React + Tailwind SPA
```
- The **proxy** is stateless per request; it holds secrets, hosts tools/MCP/RAG, and serves the built SPA in production.
- The **SPA** talks only to `/api/*`; it owns conversation history (localStorage) and never sees API keys.

## ✅ Prerequisites
- **Node.js ≥ 20** and **pnpm** (`npm i -g pnpm` or `corepack enable`)
- An **Ollama** daemon running locally (optional, for local models)
- A **z.ai** API key (optional, for GLM) — get one at <https://z.ai/manage-apikey/apikey-list>

## 🚀 Quick start

```bash
# 1. Install everything (monorepo)
pnpm install

# 2. (Optional) seed a z.ai key into the proxy
cp .env.example .env
#   edit .env and set ZAI_API_KEY=...

# 3. Dev mode — runs proxy (:8787) + web (:5173) together
pnpm dev
#   then open http://localhost:5173
```
In dev, the web app proxies `/api/*` to `:8787`, so you use one origin. Add your API key in **Settings** (gear icon) — it's stored in `apps/server/data/settings.json` (gitignored).

## 📦 Production / single-port build

```bash
pnpm build                 # builds web → apps/server/web-dist, compiles proxy
cd apps/server
PORT=8787 node dist/index.js   # serves SPA + API on http://localhost:8787
```

## 🔧 Configuration
Everything is configurable from the **Settings** UI:
- **Providers** — edit built-ins (z.ai, Ollama, OpenRouter, LM Studio) or **+ Add** a custom OpenAI-compatible endpoint (name, base URL, API key)
- **Active provider/model** — pick from the composer's dropdowns (live `/models` discovery)
- **Default system prompt**, **reasoning effort**, **tools on/off** are per-turn in the composer

You can also pre-seed via env (see `.env.example`):
```
ZAI_API_KEY=...            # z.ai GLM Coding Plan (international)
OLLAMA_BASE_URL=http://localhost:11434
LLMWEBCHAT_DATA_DIR=./data  # where the proxy stores settings.json
PORT=8787
```

## ⚠️ z.ai Coding Plan — please read
z.ai's [Usage Policy](https://docs.z.ai/devpack/usage-policy) states the GLM Coding Plan *"may only be used within officially supported tools and products. Use in unsupported tools may result in restricted benefits."* Supported tools are coding agents (Claude Code, Cline, Cursor, Pi, …) — **not** a general web chat.

LLMWebChat is built provider-agnostic on purpose: if a coding-plan key gets flagged, switch the active provider to the z.ai metered API, OpenRouter, or local Ollama without changing any code. **You own the key and the backend.**

## 🛠️ Development

```bash
pnpm dev:server        # proxy only (tsx watch)
pnpm dev:web           # web only (vite)
pnpm typecheck         # all workspaces
pnpm build             # all workspaces
```

Conventions when adding features:
1. Types that cross HTTP → `packages/shared`
2. Transport/provider logic → `packages/providers`
3. Server-side trust/execution/secrets → `apps/server` (+ register route in `src/index.ts`)
4. UI → `apps/web/src/components`
5. `pnpm typecheck && pnpm build` before committing

## 📄 License
MIT.
