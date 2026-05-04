import Groq from "groq-sdk";
import { GROQ_JUDGE_MODEL } from "../../config/constants.js";
import type { ToolJudge } from "../../core/ToolJudge.js";

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

export class GroqJudge implements ToolJudge {
  constructor(private readonly client: Groq) {}

  async evaluatePre(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<{ passed: boolean; reason: string }> {
    const response = await this.client.chat.completions.create({
      model: GROQ_JUDGE_MODEL,
      messages: [
        { role: "system", content: PRE_JUDGE_PROMPT },
        {
          role: "user",
          content: `Tool: ${toolName}\nArguments:\n${JSON.stringify(args).slice(0, 8000)}`,
        },
      ],
    });

    const text = response.choices[0]?.message.content?.trim() ?? "";
    const passed = text.toUpperCase().startsWith("PASS");
    const reason =
      text.replace(/^(PASS|FAIL):\s*/i, "") || "No judge reason returned.";

    return { passed, reason };
  }

  async evaluate(
    toolName: string,
    toolOutput: string,
  ): Promise<{ passed: boolean; reason: string }> {
    const response = await this.client.chat.completions.create({
      model: GROQ_JUDGE_MODEL,
      messages: [
        { role: "system", content: JUDGE_PROMPT },
        {
          role: "user",
          content: `Tool: ${toolName}\nOutput:\n${toolOutput.slice(0, 3000)}`,
        },
      ],
    });

    const text = response.choices[0]?.message.content?.trim() ?? "";
    const passed = text.toUpperCase().startsWith("PASS");
    const reason =
      text.replace(/^(PASS|FAIL):\s*/i, "") || "No judge reason returned.";

    return { passed, reason };
  }
}
