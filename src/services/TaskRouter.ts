import type { TaskRoute, TaskType } from "../config/models.js";
import { MODEL_ROUTES, FALLBACK_ROUTES } from "../config/models.js";

export type OpenAICompatibleConnection = {
  baseURL: string;
  apiKey: string;
};

export class TaskRouter {
  private failedRoutes = new Set<string>();

  private routeKey(route: TaskRoute): string {
    return `${route.provider}:${route.model}`;
  }

  resolve(task: TaskType): TaskRoute {
    const primary = MODEL_ROUTES[task];

    if (!this.failedRoutes.has(this.routeKey(primary))) {
      return primary;
    }

    const fallback = FALLBACK_ROUTES[task];

    if (fallback && !this.failedRoutes.has(this.routeKey(fallback))) {
      return fallback;
    }

    // Last resort: return primary anyway and let the caller handle it
    return primary;
  }

  markFailed(route: TaskRoute): void {
    this.failedRoutes.add(this.routeKey(route));
  }

  isOpenAICompatible(provider: string): boolean {
    return (
      provider === "groq" ||
      provider === "openrouter" ||
      provider === "cerebras"
    );
  }

  buildOpenAICompatibleClient(route: TaskRoute): OpenAICompatibleConnection {
    const keyMap: Record<string, string[]> = {
      groq: ["GROQ_API_KEY", "groq_api_key"],
      openrouter: ["OPENROUTER_API_KEY", "openrouter_api_key"],
      cerebras: ["CEREBRAS_API_KEY", "cerebras_api_key"],
      anthropic: ["ANTHROPIC_API_KEY", "anthropic_api_key"],
    };

    const keyNames = keyMap[route.provider] ?? [];
    const apiKey = keyNames.map((k) => process.env[k]).find(Boolean) ?? "";

    return {
      baseURL: route.baseUrl ?? this.defaultBaseUrl(route.provider),
      apiKey,
    };
  }

  private defaultBaseUrl(provider: string): string {
    const urls: Record<string, string> = {
      groq: "https://api.groq.com/openai/v1",
      openrouter: "https://openrouter.ai/api/v1",
      cerebras: "https://api.cerebras.ai/v1",
    };
    return urls[provider] ?? "";
  }

  hasApiKey(route: TaskRoute): boolean {
    return !!this.buildOpenAICompatibleClient(route).apiKey;
  }
}
