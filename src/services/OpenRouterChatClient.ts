import { API_ENDPOINTS, APP_HTTP_HEADERS } from "../config/modelRuntime.js";
import type {
  ChatCompletionResponse,
  LlmContentBlock,
} from "../core/LlmContent.js";

export class OpenRouterChatClient {
  constructor(private readonly apiKey: string | undefined) {}

  hasApiKey(): boolean {
    return !!this.apiKey;
  }

  async createCompletion(
    model: string,
    system: string,
    content: LlmContentBlock[],
    maxTokens: number,
    signal?: AbortSignal,
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error("OPENROUTER_API_KEY not set");
    }

    const response = await fetch(API_ENDPOINTS.openRouterChatCompletions, {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        "HTTP-Referer": APP_HTTP_HEADERS.referer,
        "X-Title": APP_HTTP_HEADERS.title,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [
          {
            role: "user",
            content: this.toOpenRouterContent(content),
          },
        ],
        system,
      }),
    });

    const data = (await response.json()) as ChatCompletionResponse;
    if (!response.ok || data.error) {
      throw new Error(
        data.error?.message ??
          `OpenRouter API request failed with status ${response.status}`,
      );
    }

    return data.choices?.[0]?.message?.content?.trim() ?? "";
  }

  private toOpenRouterContent(content: LlmContentBlock[]) {
    return content.map((block) =>
      block.type === "image"
        ? {
            type: "image_url",
            image_url: {
              url: `data:image/png;base64,${block.source.data}`,
            },
          }
        : { type: "text", text: block.text },
    );
  }
}
