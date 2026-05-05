import { APP_HTTP_HEADERS } from "../config/modelRuntime.js";
import type { TaskRoute } from "../config/models.js";
import type { ChatCompletionResponse } from "../core/LlmContent.js";
import type { TaskRouter } from "./TaskRouter.js";

export class OpenAICompatibleClient {
  constructor(private readonly router: TaskRouter) {}

  async createTextCompletion(
    route: TaskRoute,
    system: string,
    userMessage: string,
    maxTokens: number,
    signal?: AbortSignal,
  ): Promise<string> {
    const { baseURL, apiKey } = this.router.buildOpenAICompatibleClient(route);

    if (!apiKey) {
      throw new Error(`${route.provider.toUpperCase()} API key not set`);
    }

    const response = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": APP_HTTP_HEADERS.referer,
        "X-Title": APP_HTTP_HEADERS.title,
      },
      body: JSON.stringify({
        model: route.model,
        max_tokens: maxTokens,
        temperature: 0,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMessage },
        ],
      }),
    });

    const data = (await response.json()) as ChatCompletionResponse;
    if (response.status === 429) {
      this.router.markFailed(route);
      throw new Error(`${route.provider} quota exceeded`);
    }

    if (!response.ok || data.error) {
      throw new Error(
        data.error?.message ??
          `${route.provider} API request failed with status ${response.status}`,
      );
    }

    return data.choices?.[0]?.message?.content?.trim() ?? "";
  }
}
