# Competitive Research: LLM Web Chat Interfaces

Research compiled for designing a best-in-class LLM chat interface. Sources: repo READMEs of OpenWebUI, LibreChat, LobeChat; z.ai developer docs (docs.z.ai); product pages of Claude.ai, ChatGPT, chat.z.ai.

---

## 1. Open-Source Projects Analyzed

### Open WebUI (open-webui/open-webui) — the "kitchen sink"
The most feature-complete self-hostable platform. Frontend SvelteKit, backend Python/FastAPI.

**Capabilities:**
- **Multi-provider**: Ollama + any OpenAI-compatible API (LMStudio, GroqCloud, Mistral, OpenRouter, vLLM) freely mixed
- **Extensibility system**: Filters, Actions, Pipes, Tools, Skills + **MCP / MCPO / OpenAPI tool servers**
- **Models & Agents**: wrap a base model with custom instructions + tools + knowledge → specialized agents; dynamic variables; per-user/group access control; community preset import
- **Channels**: real-time shared spaces where team + AI models collaborate in one timeline (tag models, threads, reactions, pins)
- **Calendar & AI Scheduling**: conversational schedule management via native function calling
- **RAG**: 9 vector DBs (Chroma, PGVector, Qdrant, Milvus, ES, OpenSearch, Pinecone, S3Vector, Oracle); hybrid search (BM25 + vector) with reranking; `#`-command to inject docs/URLs
- **Web search**: dozens of providers (SearXNG, Brave, Tavily, Kagi, DuckDuckGo, Jina, Exa, Bing…)
- **Image gen/editing**: DALL·E, Gemini, ComfyUI, A1111
- **Multi-model conversations**: run several models in parallel in one chat
- **Voice/video calls**: multiple STT (Whisper, Deepgram, Azure) + TTS (ElevenLabs, OpenAI, Azure) engines
- **Artifact storage**: key-value API for journals/trackers/leaderboards
- **Analytics + model evaluation**: usage dashboards, arena, A/B testing, ELO leaderboards
- **Storage flexibility**: SQLite/Postgres; local/S3/GCS/Azure; OpenTelemetry; Redis-backed horizontal scaling
- **Other**: notes, folders, memories, prompts library, terminals, mobile-first "Computer" agent, native desktop app

### LibreChat (danny-avila/LibreChat) — ChatGPT++ with agents
~42k stars. React/Node. Strong on conversation management & agents.

**Standout features to steal:**
- **Code Interpreter API** (sandboxed execution)
- **Agents**: marketplace, shareable, **Skills** (`SKILL.md` instruction bundles: manual/automatic/always-on), **Subagents** (delegated child runs w/ own context), MCP tools
- **Generative UI Code Artifacts**: React, HTML, Mermaid diagrams rendered in-chat
- **Presets & context management**: create/save/share; switch endpoints/presets mid-chat
- **Conversation branching & forking** (edit/resubmit/continue)
- **Resumable streams** → multi-tab & multi-device sync of the same chat
- **Search** all messages/conversations
- **Image gen/editing** (GPT-Image-1, DALL·E, SD, Flux, MCP)
- Multi-user secure auth (OAuth2, LDAP, email), live admin panel

### LobeChat (lobehub/lobe-chat) — agents as the unit of work
Next.js/React. Premium polish, plugin/marketplace ecosystem.

**Standout features:**
- **Agent Builder**: describe → auto-configured agent
- **10,000+ skills** via MCP-compatible plugins
- **Agent Groups**: multi-agent parallel collaboration, iterative improvement
- **Personal Memory**: white-box (editable, transparent), continual learning
- **Pages** (multi-agent content), **Schedule** (timed runs), **Workspaces** (teams)
- Plugins as first-class function-calling + custom render results
- TTS/STT subsystem (@lobehub/tts), mobile-first design

### Others noted
- **chatbox**, **ChatGPT-Next-Web**, **aichat** (CLI) — lighter, single-user, good UX references

---

## 2. Proprietary Interfaces Analyzed

### Claude.ai (Anthropic)
- **Artifacts**: live side panel rendering code/markdown/HTML/SVG/React (the killer UX)
- **Projects**: shared knowledge + custom system prompt per project
- **MCP connectors**: connect external tools/data
- **Analysis tool**: Python sandbox for data work
- **Thinking display**: collapsible reasoning traces
- Citations, file uploads, prompt caching, memory

### ChatGPT (OpenAI)
- **Canvas**: collaborative editing surface
- **Code Interpreter**, **GPTs** (custom models/marketplace)
- Memory + custom instructions, Projects, Connectors
- Image gen (DALL·E), deep research, voice mode

### chat.z.ai (Zhipu) — the GLM consumer product
- Deep Research, Artifacts, image/video generation, agents
- Models: GLM-5.2, GLM-4.6/4.5, GLM-5-Turbo, etc.
- Coding tier positioning

---

## 3. Feature Inventory (what we can adopt)

| Category | Features observed | Source |
|---|---|---|
| **Rendering** | Markdown+GFM, LaTeX/KaTeX, syntax highlight, Mermaid, **live Artifacts (React/HTML/SVG)** | Claude, LibreChat |
| **Reasoning UX** | Collapsible thinking stream, reasoning-effort control | Claude, z.ai |
| **Conversation mgmt** | Branching, forking, edit/resubmit/continue, search, folders, pins | LibreChat, ChatGPT |
| **Multi-model** | Side-by-side parallel responses, model routing, cycle models | OpenWebUI, Pi |
| **Agents/Tools** | MCP servers, function calling, tool-call visualization, subagents | LibreChat, LobeChat, OpenWebUI |
| **Knowledge** | RAG (hybrid search + rerank), `#`-inject, project knowledge bases | OpenWebUI, Claude |
| **Web access** | Web search, URL reader, browser agent | OpenWebUI, z.ai |
| **Execution** | Code interpreter (Python/Node sandbox), generative UI | ChatGPT, LibreChat |
| **Multimodal** | Image/audio/video/file input + image/video gen | z.ai, OpenWebUI |
| **Memory** | Editable, hierarchical (global + per-project), continual learning | LobeChat, ChatGPT |
| **Collaboration** | Shared channels, shareable presets/agents, multi-device sync | OpenWebUI, LibreChat |
| **Voice** | Real-time STT/TTS, voice/video calls | OpenWebUI, ChatGPT |
| **Platform** | Presets/prompt library, theming/branding, plugins, i18n, PWA/desktop | OpenWebUI, LobeChat |

---

## 4. The z.ai GLM Coding Plan (technical facts)

- **Endpoint**: `https://api.z.ai/api/paas/v4/chat/completions` — **OpenAI-compatible**
- **Auth**: `Authorization: Bearer <ZAI_API_KEY>` (Global/international key)
- **Models**: `glm-5.2`, `glm-5.1`, `glm-5`, `glm-5-turbo`, `glm-5v-turbo`, `glm-4.7`, `glm-4.6`, `glm-4.5`, `glm-4.5v`, `glm-4-32b-0414-128k`
- **Streaming**: standard SSE `stream: true`
- **Deep Thinking**: `thinking.type` = `enabled`|`disabled` + `reasoning_effort` = `max|xhigh|high|medium|low|minimal|none` (GLM-5.2+). Reasoning surfaced in stream.
- **Capabilities**: function calling, structured output, context caching, multimodal (text/image/audio/video/file)
- **Other z.ai tools** (separate endpoints, also callable): web search, web reader, GLM-OCR (layout parsing), GLM-ASR (audio transcription), GLM-Image / CogView-4 (image gen), CogVideoX (video gen), embeddings, translation agent, slide/poster agent

### ⚠️ CRITICAL POLICY CAVEAT
The z.ai docs **explicitly** state:
> "GLM Coding Plan may only be used within officially supported tools and products. Use in unsupported tools may result in restricted benefits." Violations can trigger rate limiting, account freezing, or bans (3+ violations).

Supported tools are **coding agents** (Claude Code, Cline, Cursor, Kilo, OpenCode, Pi, Goose, Crush, Roo…). **A general web-chat UI is NOT on that list.** The API is OpenAI-compatible so it *will* technically respond to any client, but using the coding-plan key from a custom web UI carries real risk of being flagged by their risk-control system.

> **Note**: Pi (this agent) *is* an officially supported tool, which is why the current session runs on it.

## 5. Local Model Support

- **Ollama** exposes an OpenAI-compatible API at `http://localhost:11434/v1/chat/completions` and `/v1/embeddings` → drops into the same client as z.ai.
- **LM Studio**, **vLLM**, **llama.cpp server**, **Jan** all expose OpenAI-compatible `/v1` endpoints.
- ⇒ A single OpenAI-compatible provider abstraction covers z.ai + every local runner. This is the core design principle.
