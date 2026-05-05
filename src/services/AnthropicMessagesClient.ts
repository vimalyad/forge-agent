import { API_ENDPOINTS } from "../config/modelRuntime.js";
import type { LlmContentBlock } from "../core/LlmContent.js";

type AnthropicResponse = {
  content?: { type: string; text?: string }[];
  error?: { message?: string };
};

export class AnthropicMessagesClient {
  constructor(private readonly apiKey: string) {}

  async createMessage(
    model: string,
    system: string,
    content: LlmContentBlock[],
    maxTokens: number,
    signal?: AbortSignal,
  ): Promise<string> {
    const response = await fetch(API_ENDPOINTS.anthropicMessages, {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature: 0.25,
        system,
        messages: [{ role: "user", content }],
      }),
    });

    const data = (await response.json()) as AnthropicResponse;
    if (!response.ok || data.error) {
      throw new Error(
        data.error?.message ??
          `Anthropic API request failed with status ${response.status}`,
      );
    }

    return (
      data.content
        ?.filter((block) => block.type === "text" && block.text)
        .map((block) => block.text)
        .join("\n")
        .trim() ?? ""
    );
  }
}
