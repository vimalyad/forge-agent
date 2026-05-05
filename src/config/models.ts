import {
  DEFAULT_ANTHROPIC_CODE_MODEL,
  DEFAULT_ANTHROPIC_FAST_MODEL,
  GROQ_JUDGE_MODEL,
} from "./constants.js";

export type ModelProvider = "anthropic" | "groq" | "openrouter" | "cerebras";

export type TaskType = "url_resolve" | "code_gen" | "vision" | "judge";

export type TaskRoute = {
  provider: ModelProvider;
  model: string;
  baseUrl?: string;
};

export const MODEL_ROUTES: Record<TaskType, TaskRoute> = {
  url_resolve: { provider: "anthropic", model: DEFAULT_ANTHROPIC_FAST_MODEL },
  code_gen: { provider: "anthropic", model: DEFAULT_ANTHROPIC_CODE_MODEL },
  vision: { provider: "anthropic", model: DEFAULT_ANTHROPIC_CODE_MODEL },
  judge: { provider: "groq", model: GROQ_JUDGE_MODEL },
};

export const FALLBACK_ROUTES: Partial<Record<TaskType, TaskRoute>> = {
  judge: {
    provider: "cerebras",
    model: "llama-3.3-70b",
    baseUrl: "https://api.cerebras.ai/v1",
  },
};

export type ModelOption = {
  id: string;
  label: string;
  provider: ModelProvider;
  model: string;
  apiKeyNames: string[];
};

export const ACTIVE_MODEL_OPTION: ModelOption = {
  id: "anthropic-code",
  label: "Anthropic Claude Code Generation",
  provider: "anthropic",
  model: DEFAULT_ANTHROPIC_CODE_MODEL,
  apiKeyNames: ["ANTHROPIC_API_KEY", "anthropic_api_key"],
};

export const MODEL_OPTIONS: ModelOption[] = [
  ACTIVE_MODEL_OPTION,
];

export const DEFAULT_MODEL_OPTION = ACTIVE_MODEL_OPTION;
