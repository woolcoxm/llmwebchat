# LLMWebChat

> An advanced, provider-agnostic LLM web chat interface. Local-first (Ollama/LM Studio) with support for any OpenAI-compatible cloud provider, full-agentic, secrets held in the proxy.

**Status:** Phase 0 (foundation) — streaming chat to GLM and any OpenAI-compatible endpoint is working end-to-end. See [PLAN.md](./PLAN.md) for what's built and what's next, [DESIGN.md](./DESIGN.md) for architecture, and [RESEARCH.md](./RESEARCH.md) for the competitive analysis it's based on.

---

## ✨ What's here now
- **Provider-agnostic** — Ollama, LM Studio, OpenRouter, or any custom OpenAI-compatible URL, all behind one client
- **Reasoning stream** — model reasoning/thinking output rendered in a collapsible panel, with per-message effort control for reasoning-capable providers
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
- A **local model runner** (recommended): [Ollama](https://ollama.com) — `ollama pull llama3.2`
- Optionally, an API key for a cloud OpenAI-compatible provider (OpenRouter, etc.)

## 🚀 Quick start

```bash
# 1. Install everything (monorepo)
pnpm install

# 2. (Optional) pre-seed a provider key into the proxy
cp .env.example .env
#   edit .env as needed

# 3. Dev mode — runs proxy (:8787) + web (:5173) together
pnpm dev
#   then open http://localhost:5173
```
In dev, the web app proxies `/api/*` to `:8787`, so you use one origin. Configure providers and add API keys in **Settings** (gear icon) — stored in `apps/server/data/settings.json` (gitignored).

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
OLLAMA_BASE_URL=http://localhost:11434
OPENROUTER_API_KEY=...        # optional, for the OpenRouter preset
LLMWEBCHAT_DATA_DIR=./data    # where the proxy stores settings.json
PORT=8787
```

## 🔒 Security & privacy
- The proxy binds to **127.0.0.1** by default — no network exposure. Set `LLMWEBCHAT_HOST` to override (then also set `LLMWEBCHAT_AUTH_TOKEN`).
- API keys live only in the proxy; the browser never sees them.
- Server-side tools are sandboxed: web tools block SSRF (private/loopback/metadata IPs), file tools are confined to a workspace root, `run_bash` is **off by default** and runs with a sanitized environment.
- It's provider-agnostic by design: pick whatever backend suits you.

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
