import { DEFAULT_GEMINI_MODEL, DEFAULT_GROQ_MODEL } from "./constants.js";

export type ModelProvider = "gemini" | "groq";

export type ModelOption = {
  id: string;
  label: string;
  provider: ModelProvider;
  model: string;
  apiKeyNames: string[];
};

export const MODEL_OPTIONS: ModelOption[] = [
  {
    id: "gemini-flash",
    label: "Gemini 2.5 Flash",
    provider: "gemini",
    model: DEFAULT_GEMINI_MODEL,
    apiKeyNames: ["GEMINI_API_KEY", "gemini_api_key"],
  },
  {
    id: "gemini-pro",
    label: "Gemini 2.5 Pro",
    provider: "gemini",
    model: "gemini-2.5-pro",
    apiKeyNames: ["GEMINI_API_KEY", "gemini_api_key"],
  },
  {
    id: "groq-scout",
    label: "Groq Llama 4 Scout",
    provider: "groq",
    model: DEFAULT_GROQ_MODEL,
    apiKeyNames: ["GROQ_API_KEY", "groq_api_key"],
  },
  {
    id: "groq-llama-3",
    label: "Groq Llama 3.3 70B",
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    apiKeyNames: ["GROQ_API_KEY", "groq_api_key"],
  },
];

export const DEFAULT_MODEL_OPTION = MODEL_OPTIONS[0];
