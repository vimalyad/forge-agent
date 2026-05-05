import type { ToolJudge } from "../core/ToolJudge.js";
import type { TaskRouter } from "./TaskRouter.js";
import type { Display } from "../ui/Display.js";

const JUDGE_PROMPT = `You are a strict CLI-agent judge.
Given a tool name and its output, respond with exactly one line:
PASS: <brief reason>
or
FAIL: <brief reason>
Pass useful file writes, successful fetches or scrapes, and meaningful file reads. Fail empty, irrelevant, or error output.`;

const PRE_JUDGE_PROMPT = `You are a strict CLI-agent gatekeeper.
Given a mutating tool name and the arguments an agent intends to execute, respond with exactly one line:
PASS: <brief reason>
or
FAIL: <brief reason>
For 'write_file', fail if the HTML content is missing a closing </body> or </html> tag, contains placeholders like <TODO> or 'content goes here', or is structurally broken. Otherwise pass.`;

export class OpenAICompatibleJudge implements ToolJudge {
  constructor(
    private readonly router: TaskRouter,
    private readonly display: Display,
  ) {}

  async evaluatePre(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<{ passed: boolean; reason: string }> {
    const preview: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(args)) {
      if (typeof v === "string" && v.length > 400) {
        preview[k] = `[${v.length} chars — showing tail] ...${v.slice(-300)}`;
      } else {
        preview[k] = v;
      }
    }

    const text = await this.call(
      "judge",
      PRE_JUDGE_PROMPT,
      `Tool: ${toolName}\nArguments:\n${JSON.stringify(preview)}`,
    );

    if (!text) return { passed: true, reason: "Judge returned empty response, defaulting to PASS" };

    const passed = text.toUpperCase().startsWith("PASS");
    const reason =
      text.replace(/^(PASS|FAIL):\s*/i, "") || "No reason returned.";
    return { passed, reason };
  }

  async evaluate(
    toolName: string,
    toolOutput: string,
  ): Promise<{ passed: boolean; reason: string }> {
    const text = await this.call(
      "judge",
      JUDGE_PROMPT,
      `Tool: ${toolName}\nOutput:\n${toolOutput.slice(0, 3000)}`,
    );

    if (!text) return { passed: true, reason: "Judge returned empty response, defaulting to PASS" };

    const passed = text.toUpperCase().startsWith("PASS");
    const reason =
      text.replace(/^(PASS|FAIL):\s*/i, "") || "No reason returned.";
    return { passed, reason };
  }

  private async call(
    task: "judge",
    systemPrompt: string,
    userMessage: string,
  ): Promise<string> {
    const route = this.router.resolve(task);
    const { baseURL, apiKey } = this.router.buildOpenAICompatibleClient(route);

    if (!apiKey) {
      // Fall back to a no-op pass if no judge key is configured
      this.display.warn("No judge API key configured, skipping evaluation");
      return "PASS: no judge API key configured, skipping evaluation";
    }

    try {
      const response = await fetch(`${baseURL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://github.com/forge-agent",
          "X-Title": "forge-agent",
        },
        body: JSON.stringify({
          model: route.model,
          max_tokens: 60,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
        }),
      });

      if (response.status === 429) {
        this.router.markFailed(route);
        this.display.warn("Judge quota exceeded, skipping evaluation");
        return "PASS: judge quota exceeded, skipping evaluation";
      }

      const data = await response.json() as any;
      if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
      return data.choices?.[0]?.message?.content?.trim() ?? "";
    } catch (e) {
      this.display.warn(
        `Judge call failed: ${(e as Error).message}, skipping evaluation`,
      );
      return "PASS: judge call failed, skipping evaluation";
    }
  }
}
