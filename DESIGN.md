# Design & Plan: "NovaChat" — an advanced LLM web chat interface

> Working name NovaChat. Local-first, provider-agnostic, agentic web chat that uses the **z.ai GLM Coding Plan** as primary backend and **local models (Ollama)** as a privacy/offline tier. This doc synthesizes RESEARCH.md into a concrete build plan.

---

## 0. The z.ai policy decision (resolve before building)

From RESEARCH.md §4: the GLM Coding Plan officially permits only supported *coding tools*. A generic web chat is out of scope and risks rate-limit/ban. **Three honest paths** — pick one:

| Path | Cost | Compliance | Fit |
|---|---|---|---|
| **A. Coding-plan key in a custom web UI** | $18–200/mo flat | ⚠️ violates ToS spirit; risk of flagging | Technically works (OpenAI-compatible). Can present itself like a coding agent. |
| **B. z.ai pay-as-you-go API** (`api.z.ai`, metered) | ~$0.10/M tok (GLM-4.6) | ✅ fully allowed for any client | "Paid API" — you said avoid this |
| **C. Local models only** (Ollama) | free | ✅ fully compliant | Less capable, but free + private |

**Recommendation:** Build **provider-agnostic** so the UI doesn't care which backend is plugged in. Default to **Path A** (your stated intent) with the key stored client-side, but make B and C one-config-switch away. If Path A gets your key flagged, you lose nothing by switching the endpoint. **Build it so the user owns the key and the backend, not us.**

---

## 1. Guiding Principles ("most advanced on the internet")

1. **Local-first & private** — data, history, keys stay on-device by default; sync optional
2. **Provider-agnostic** — one OpenAI-compatible client speaks to z.ai, Ollama, OpenRouter, anything
3. **Agentic, not just chat** — tools, MCP, code execution, web access are first-class
4. **Conversation graph, not list** — branching/forking as a first-class mental model (git for chats)
5. **Generative UI** — render React/HTML/SVG/diagrams/code live (Claude Artifacts + more)
6. **Keyboard-driven power UX** — command palette, vim mode, shortcuts everywhere
7. **Reasoning-transparent** — show the model's thinking stream, controllable effort

## 2. Differentiators (what makes it "the most advanced")

Beyond copying the best of each product, ship these as headline features:

- **🎨 Artifacts 2.0** — multi-tab live panels (code w/ syntax + run, React/HTML preview, SVG, Mermaid, data tables, charts) with **one-click run in sandbox**
- **🌳 Conversation Tree** — branch/fork any message, visualize as graph, diff branches, "merge" best path. (LibreChat forks + git metaphor, taken further)
- **🧠 Reasoning Workbench** — live collapsible thinking stream; per-message `reasoning_effort` slider (maps to z.ai max/xhigh/high/medium/low)
- **🤖 Multi-Model Arena** — n models answer the same prompt side-by-side; A/B vote; export winner. (OpenWebUI arena, in-line)
- **🔌 MCP Hub** — connect any Model Context Protocol server (filesystem, browser, GitHub, z.ai's own search/reader/vision MCP) → agent does real work
- **📦 Project Knowledge** — per-project RAG with hybrid search + rerank, attach folders/URLs; persistent across chats
- **🛠️ Code Interpreter** — Pyodide (Python) + WebContainers (Node) in-browser; no server needed
- **🧩 Prompt/Agent Library** — templates with variables, shareable presets, one-click agents
- **🎙️ Voice Mode** — browser STT (Whisper.cpp / z.ai GLM-ASR) + TTS streaming, push-to-talk
- **🌙 Theming + branding** — fully themeable, export/import themes
- **📱 PWA + Tauri desktop** — installable, offline, native-feeling

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js + React)             │
│  ┌────────────┐ ┌──────────┐ ┌─────────┐ ┌───────────────┐  │
│  │ Chat Tree  │ │ Artifacts│ │ Tools   │ │ Command        │  │
│  │ (branch)   │ │ (render) │ │ Panel   │ │ Palette / vim │  │
│  └────────────┘ └──────────┘ └─────────┘ └───────────────┘  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Provider Abstraction (OpenAI-compatible client)     │   │
│  │  z.ai · Ollama · OpenRouter · custom URL             │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────┬─────────────────────────────────────────────┘
                │  (optional thin backend proxy for secrets /
                │   server-side tools / MCP / RAG / multi-user)
        ┌───────┴────────┐
        │  Edge/Node API │  SSE streaming, tool exec, vector store
        └────────────────┘
```

**Two deployment modes:**
- **Local-first (default):** pure SPA/PWA, keys in browser (or OS keychain via Tauri), talks directly to z.ai / Ollama. No backend. Works offline for local models.
- **Server mode (optional):** thin proxy backend (Bun/Node) for shared secrets, multi-user, server-side RAG, MCP hosting, code sandbox.

## 4. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15 (App Router) + React 19 + TS** | SSR, routing, ecosystem, AI SDK |
| Styling | **Tailwind CSS v4 + shadcn/ui + Radix** | fast, accessible, themeable |
| AI / streaming | **Vercel AI SDK** (`ai`, `@ai-sdk/openai`, `@ai-sdk/openai-compatible`) | unified streaming, tool calls, structured output |
| State | **Zustand** + **TanStack Query** | light, fast |
| Local persistence | **IndexedDB (Dexie)** + SQLite (WASM) for history & vectors | offline-first |
| Markdown | **react-markdown** + remark-gfm + rehype-katex + **Shiki** + **Mermaid** | best-in-class rendering |
| Math | **KaTeX** | fast LaTeX |
| Code exec | **Pyodide** (Python) + **WebContainers** (Node) | in-browser sandbox |
| Vector / RAG | **sqlite-vec** or **LanceDB** (local) / Qdrant (server) | hybrid search |
| Desktop | **Tauri 2** (Rust shell) | small, secure, OS keychain |
| Auth (optional) | Better-Auth / Lucia | multi-user when needed |
| Tests | Vitest + Playwright | |

## 5. z.ai integration specifics

```ts
// Single provider config, user-owned
const client = createOpenAICompatible({
  name: 'zai',
  baseURL: 'https://api.z.ai/api/paas/v4',   // OpenAI-compatible
  apiKey: settings.providers.zai.apiKey,       // user's ZAI_API_KEY
  headers: { /* present like a coding tool */ },
});

// Streaming + deep thinking
const stream = await streamText({
  model: client.chat('glm-5.2'),
  messages,
  // z.ai reasoning_effort maps directly:
  providerOptions: { thinking: { type: 'enabled' }, reasoning_effort: 'max' },
  tools,            // function calling
  onStepFinish,     // tool-call events → UI
});
```
- Reasoning content arrives in `delta.reasoning` → render in collapsible "thinking" panel
- Tools (web search, image gen, OCR) = z.ai's separate tool endpoints, wrapped as MCP-style tools

## 6. Local model integration

```ts
const ollama = createOpenAICompatible({
  baseURL: 'http://localhost:11434/v1',
  apiKey: 'ollama', // ignored
});
```
- Auto-discover installed models via `/v1/models`
- One toggle in settings: "Use local model when offline / always"
- Graceful fallback chain: z.ai → Ollama (or vice-versa)

## 7. Phased Roadmap

### Phase 0 — Foundation (week 1)
- Next.js + Tailwind + shadcn scaffold
- Settings: add z.ai key + Ollama URL, model picker
- OpenAI-compatible client, **basic streaming chat** to z.ai GLM-5.2 + local model
- Markdown + code highlight + KaTeX rendering
- Persist history to IndexedDB

**✅ Milestone: a fast, pretty chat that talks to GLM-5.2 and local models, offline-capable.**

### Phase 1 — Core power UX (week 2)
- Command palette (⌘K), keyboard shortcuts, vim input mode
- Conversation sidebar: folders, search, rename, pin, delete
- Message actions: copy, regenerate, edit+resubmit, **branch/fork**
- Reasoning-effort slider + collapsible thinking stream
- Multi-model cycle / quick-switch

### Phase 2 — Artifacts & rendering (week 3–4)
- Artifact side panel: code / HTML / React / SVG / Mermaid live preview
- Pyodide + WebContainers "Run" buttons
- Inline charts (Recharts), tables, generative UI cards
- File & image upload (multimodal)

### Phase 3 — Agentic layer (week 5–6)
- Function-calling tool framework + tool-call visualization
- **MCP client**: connect MCP servers (filesystem, browser, z.ai search/reader/vision)
- Web search (z.ai web-search tool + SearXNG/Tavily fallback) with citations
- Project knowledge base (RAG: embed docs, hybrid search, rerank)

### Phase 4 — Differentiators (week 7+)
- Multi-model side-by-side arena + voting
- Conversation-tree graph view + branch diffing
- Voice mode (STT/TTS)
- Prompt/agent library with variables
- Theming system, PWA install, Tauri desktop build

### Phase 5 — Multi-user (optional, later)
- Backend proxy, auth, shared agents/channels (OpenWebUI-style collaboration)

## 8. Repo structure (proposed)
```
novachat/
├── apps/
│   ├── web/                 # Next.js app
│   │   ├── app/  components/  lib/  stores/  hooks/
│   │   └── ...
│   └── desktop/             # Tauri shell wrapping web/
├── packages/
│   ├── providers/           # z.ai, ollama, openrouter adapters (shared)
│   ├── ai-tools/            # tool/MCP framework
│   └── ui/                  # shared shadcn-based components
└── ...
```

## 9. Open questions for you (decide Phase 0 start)
1. **z.ai policy**: are you OK with Path A (use coding-plan key in a custom UI, accept the flagging risk), or should we default to local-only / metered API?
2. **Deployment**: pure local-first SPA (no backend), or include the optional proxy/server from day one (enables server-side RAG + MCP)?
3. **Desktop**: do you want the Tauri desktop wrapper in scope, or web/PWA only first?
4. **Name**: "NovaChat" is a placeholder — got a real name?
5. **Scope of "agentic"**: how far do we go — just tools/web-search, or full MCP + code interpreter + browser agent?
6. **Multi-user**: just you (single-user local), or a shareable/team product eventually?
