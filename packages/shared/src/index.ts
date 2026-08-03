/**
 * @llmwebchat/shared — the single source of truth for types shared across
 * the web frontend, the proxy server, and the provider abstraction.
 *
 * Everything here is wire-format: it crosses the HTTP boundary between
 * apps/web and apps/server, so keep it serialisable (no class instances,
 * no functions, no Symbols).
 */

/* ------------------------------------------------------------------ */
/* Providers                                                           */
/* ------------------------------------------------------------------ */

/**
 * A provider is any OpenAI-compatible endpoint. All presets (Ollama, LM Studio,
 * OpenRouter) are just preset configs — there is no special-casing in the code.
 */
export interface ProviderConfig {
  /** Stable id, e.g. "ollama", "openrouter", "lmstudio" */
  id: string;
  /** Human label */
  name: string;
  /** Kind. Always openai-compatible today; kept extensible for Anthropic-native etc. */
  kind: "openai-compatible";
  /** Base URL without trailing slash, e.g. "http://localhost:11434/v1" or "https://openrouter.ai/api/v1" */
  baseURL: string;
  /** API key. Server-side only — never sent to the browser. */
  apiKey?: string;
  /** Header name for the key. Defaults to "Authorization: Bearer <key>". */
  authHeader?: string;
  /** Optional custom headers (e.g. to present like a specific tool). */
  headers?: Record<string, string>;
  /** Known model ids for quick UI hints (discovered live via /models otherwise). */
  models?: ModelInfo[];
  /** Provider supports a reasoning effort param (sends reasoning_effort/thinking). */
  reasoning?: boolean;
  /** Marks built-in presets so the UI hides their delete button. */
  builtin?: boolean;
  /** Server-set: whether an API key is stored (client never sees the key). */
  hasKey?: boolean;
}

export interface ModelInfo {
  id: string;
  /** Display name override */
  name?: string;
  /** Supports reasoning/thinking stream */
  reasoning?: boolean;
  /** Supports vision (image input) */
  vision?: boolean;
  /** Context window in tokens, if known */
  contextLength?: number;
}

/* ------------------------------------------------------------------ */
/* Chat                                                                */
/* ------------------------------------------------------------------ */

export type Role = "system" | "user" | "assistant" | "tool";

export interface Attachment {
  id: string;
  /** Mime type */
  type: string;
  /** File name */
  name: string;
  /**
   * Either a data URL (for small inline uploads the server will convert to
   * the provider's multimodal format) or a server-side file id.
   */
  url?: string;
  /** Server-side file id (returned by POST /api/files) */
  fileId?: string;
}

export interface ToolCall {
  id: string;
  /** Tool/function name */
  name: string;
  /** JSON-encoded arguments string */
  arguments: string;
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  /** Result content (string). Errors start with "Error: ". */
  content: string;
  isError?: boolean;
}

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  /** Reasoning / chain-of-thought text (e.g. "reasoning_content"). */
  reasoning?: string;
  /** Attachments on this message (images, files). */
  attachments?: Attachment[];
  /** Tool calls issued by the assistant on this turn. */
  toolCalls?: ToolCall[];
  /** Tool results returned for prior tool calls. */
  toolResults?: ToolResult[];
  /** Pending human-in-the-loop approvals for tool calls (transient UI state). */
  pendingApprovals?: { toolCallId: string; approvalId: string }[];
  /** Model that produced an assistant message. */
  model?: string;
  /** When the message was created. */
  createdAt: number;
  /** Parent message id — enables branching/forking (conversation tree). */
  parentId?: string | null;
}

/* ------------------------------------------------------------------ */
/* Conversations                                                       */
/* ------------------------------------------------------------------ */

export interface Conversation {
  id: string;
  title: string;
  /** Root message id of the conversation tree. */
  rootMessageId?: string | null;
  /** Id of the message currently "active" (tip of the branch being viewed). */
  currentMessageId?: string | null;
  providerId?: string;
  model?: string;
  createdAt: number;
  updatedAt: number;
  /** Pinned to the top of the sidebar. */
  pinned?: boolean;
  /** Arbitrary metadata (tags, folder, etc.) */
  meta?: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export type ReasoningEffort =
  | "none"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "max";

export interface McpServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

export interface ToolsConfig {
  /** Absolute path used as the sandbox root for file/bash tools. */
  workspaceRoot?: string;
  /** web_search + web_reader. Default true. */
  allowWeb?: boolean;
  /** read_file within workspaceRoot. Default true when workspaceRoot set. */
  allowFiles?: boolean;
  /** write_file (create/overwrite). Default false. */
  allowWriteFiles?: boolean;
  /** run_bash. Default false. */
  allowBash?: boolean;
  /** Approval policy for destructive tools (write_file/run_bash/MCP): "destructive" pauses and asks the user; "never" auto-executes. Default "destructive". */
  toolApproval?: "never" | "destructive";
  /** MCP servers to connect (stdio). Each exposes its tools to the model. */
  mcpServers?: McpServerConfig[];
  /** Embedding provider for the knowledge base (default: ollama). */
  embeddingProviderId?: string;
  /** Embedding model (default: nomic-embed-text). */
  embeddingModel?: string;
}

export interface Settings {
  /** Configured providers. */
  providers: ProviderConfig[];
  /** Active provider id. */
  activeProviderId: string;
  /** Active model id. */
  activeModel: string;
  /** Default reasoning effort (sent to reasoning-capable providers). */
  defaultReasoningEffort: ReasoningEffort;
  /** System prompt prepended to every chat if conversation has none. */
  defaultSystemPrompt?: string;
  /** Temperature. */
  temperature?: number;
  /** Theme preference. */
  theme?: "system" | "light" | "dark";
  /** Server-side tool configuration. */
  tools?: ToolsConfig;
}

/* ------------------------------------------------------------------ */
/* Chat request / streaming events                                     */
/* ------------------------------------------------------------------ */

export interface ChatRequest {
  conversationId?: string;
  /** Parent message id to branch from (null = new root). */
  parentId?: string | null;
  /** Full message list (the proxy is stateless per request). */
  messages: ChatMessage[];
  providerId: string;
  model: string;
  /** Override reasoning effort for this turn. */
  reasoningEffort?: ReasoningEffort;
  temperature?: number;
  /** Tools enabled for this turn (names resolved by the proxy). */
  enabledTools?: string[];
  /** Whether tool execution/agentic loop is allowed. */
  allowTools?: boolean;
  /** Approval policy for destructive tools: "destructive" (pause + ask) or "never". */
  approvalPolicy?: "never" | "destructive";
  /** Max agentic tool-call rounds (default 10). */
  maxRounds?: number;
}

/**
 * The proxy streams a line-delimited sequence of these events to the browser
 * (one JSON object per line, NDJSON). This keeps the wire format simple and
 * resumable.
 */
export type ChatEvent =
  | { type: "start"; messageId: string; model: string }
  | { type: "delta"; content: string }
  | { type: "reasoning"; content: string }
  | { type: "tool_call"; toolCall: ToolCall }
  | { type: "approval_request"; id: string; toolCall: ToolCall; destructive: boolean }
  | { type: "tool_result"; result: ToolResult }
  | { type: "finish"; messageId: string; model: string; finishReason?: string; usage?: Usage }
  | { type: "error"; message: string; status?: number };

export interface Usage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

/* ------------------------------------------------------------------ */
/* Tools                                                               */
/* ------------------------------------------------------------------ */

export interface ToolDef {
  name: string;
  description: string;
  /** JSON schema for parameters (OpenAI function-calling format). */
  parameters: Record<string, unknown>;
  /** Whether the tool requires server-side execution (vs client). */
  serverSide?: boolean;
}

/* ------------------------------------------------------------------ */
/* Presets                                                             */
/* ------------------------------------------------------------------ */

/** Built-in provider presets shipped out of the box. apiKey is optional. */
export const PROVIDER_PRESETS: ProviderConfig[] = [
  {
    id: "ollama",
    name: "Ollama (local)",
    kind: "openai-compatible",
    baseURL: "http://localhost:11434/v1",
    apiKey: "ollama",
    builtin: true,
    headers: {},
    models: [
      { id: "llama3.2", name: "Llama 3.2" },
      { id: "llama3.1", name: "Llama 3.1" },
      { id: "qwen2.5", name: "Qwen 2.5" },
      { id: "qwen2.5-coder", name: "Qwen 2.5 Coder" },
      { id: "deepseek-r1", name: "DeepSeek R1", reasoning: true },
      { id: "phi3", name: "Phi-3" },
      { id: "mistral", name: "Mistral" },
      { id: "gemma2", name: "Gemma 2" },
    ],
  },
  {
    id: "lmstudio",
    name: "LM Studio (local)",
    kind: "openai-compatible",
    baseURL: "http://localhost:1234/v1",
    apiKey: "lm-studio",
    builtin: true,
    headers: {},
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    kind: "openai-compatible",
    baseURL: "https://openrouter.ai/api/v1",
    builtin: true,
    headers: {},
  },
];

export function defaultSettings(): Settings {
  return {
    providers: PROVIDER_PRESETS.map((p) => ({ ...p })),
    activeProviderId: "ollama",
    activeModel: "llama3.2",
    defaultReasoningEffort: "high",
    defaultSystemPrompt:
      "You are LLMWebChat, a helpful, precise assistant. Use tools when useful. Render rich content (tables, diagrams, code) in markdown.",
    temperature: undefined,
    theme: "system",
    tools: { allowWeb: true, toolApproval: "destructive" },
  };
}
