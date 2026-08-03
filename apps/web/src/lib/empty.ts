/**
 * Shared stable empty references. zustand v5 selectors used as getSnapshot
 * MUST return cached/stable values — returning an inline `[]` or `{}` causes
 * useSyncExternalStore to detect a new snapshot every render and throw
 * "Maximum update depth exceeded". Always fall back to these constants.
 */
import type { ChatMessage } from "@llmwebchat/shared";

export const EMPTY_MSGS: ChatMessage[] = [];
export const EMPTY_CHILD: Record<string, string> = {};
