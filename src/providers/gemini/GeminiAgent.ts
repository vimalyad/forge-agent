import type { Content, GoogleGenAI, Part } from "@google/genai";
import {
  DEFAULT_GEMINI_MODEL,
  MAX_AGENT_STEPS,
  SYSTEM_PROMPT,
  ENHANCEMENT_PROMPT,
} from "../../config/constants.js";
import type { Display } from "../../ui/Display.js";
import type { ToolRegistry } from "../../tools/ToolRegistry.js";
import type { IAgent } from "../../core/IAgent.js";
import type { MessageHistory } from "../../services/MessageHistory.js";
import { OutputValidator } from "../../services/OutputValidator.js";
import type { ToolJudge } from "../../core/ToolJudge.js";

const JUDGED_TOOLS = new Set([
  "write_file",
  "web_fetch",
  "scrape_website",
  "read_file",
]);
const PRE_JUDGED_TOOLS = new Set(["write_file"]);

export class GeminiAgent implements IAgent {
  constructor(
    private readonly client: GoogleGenAI,
    private readonly history: MessageHistory,
    private readonly registry: ToolRegistry,
    private readonly judge: ToolJudge,
    private readonly display: Display,
    private readonly outputValidator = new OutputValidator(),
    private readonly model = DEFAULT_GEMINI_MODEL,
  ) {}

  private latestBlueprint = "";

  async run(userInput: string, signal?: AbortSignal): Promise<void> {
    this.history.push({ role: "user", parts: [{ text: userInput }] });

    for (let step = 1; step <= MAX_AGENT_STEPS; step += 1) {
      if (signal?.aborted)
        throw Object.assign(new Error("Interrupted"), { name: "AbortError" });
      this.display.startSpinner(`thinking step ${step}`);

      let response;

      try {
        response = await this.client.models.generateContent({
          model: this.model,
          contents: this.history.all(),
          config: {
            systemInstruction: SYSTEM_PROMPT,
            tools: [{ functionDeclarations: this.registry.schemas() }],
          },
        });
      } catch (error) {
        this.display.stopSpinner(false, "API call failed");
        throw error;
      }

      this.display.stopSpinner(true);

      const modelContent = response.candidates?.[0]?.content;

      if (modelContent) {
        this.history.push(modelContent);
      }

      const text = this.textFromContent(modelContent);

      if (text) {
        this.display.agentMessage(text);
      }

      const calls = response.functionCalls;

      if (!calls?.length) {
        const validationError = await this.outputValidator.validate();

        if (!validationError) {
          await this.runEnhancementPass(signal);
          return;
        }

        this.history.push({
          role: "user",
          parts: [
            {
              text: `Final output validation failed: ${validationError} Continue and fix output/index.html before claiming completion.`,
            },
          ],
        });
        continue;
      }

      const toolResults: Part[] = [];

      for (const call of calls) {
        if (signal?.aborted)
          throw Object.assign(new Error("Interrupted"), { name: "AbortError" });
        const args = call.args as Record<string, unknown> | undefined;
        this.display.toolCall(call.name ?? "unknown", args ?? {});

        let output = "";
        let success = true;
        let screenshotBase64: string | undefined;

        try {
          if (call.name && PRE_JUDGED_TOOLS.has(call.name)) {
            const preResult = await this.judge.evaluatePre(
              call.name,
              args ?? {},
            );
            this.display.judgePreResult(
              call.name,
              preResult.passed,
              preResult.reason,
            );

            if (!preResult.passed) {
              success = false;
              output = `[PRE-EXECUTION JUDGE FAIL: ${preResult.reason}]`;
            }
          }

          if (success) {
            const rich = await this.registry.executeRich(call.name, args);
            output = rich.text;
            screenshotBase64 = rich.screenshotBase64;

            if (screenshotBase64) {
              this.display.toolResult(
                call.name ?? "unknown",
                true,
                `scraped + screenshot captured (${Math.round((screenshotBase64.length * 0.75) / 1024)}kb PNG)`,
              );
            } else {
              this.display.toolResult(
                call.name ?? "unknown",
                true,
                output.slice(0, 100),
              );
            }

            if (call.name === "scrape_website") {
              this.latestBlueprint = output;
            }
          }
        } catch (error) {
          output = `Error: ${(error as Error).message}`;
          success = false;
          this.display.toolResult(call.name ?? "unknown", false, output);
        }

        if (success && call.name && JUDGED_TOOLS.has(call.name)) {
          const result = await this.judge.evaluate(call.name, output);
          this.display.judgeResult(result.passed, result.reason);

          if (!result.passed) {
            output = `${output}\n\n[JUDGE FAIL: ${result.reason}]`;
          }
        }

        const resultParts: Part[] = [
          {
            functionResponse: {
              name: call.name,
              response: { result: output },
            },
          },
        ];

        // Attach screenshot as vision context right after the function response
        if (screenshotBase64) {
          resultParts.push({
            inlineData: {
              mimeType: "image/png",
              data: screenshotBase64,
            },
          });
        }

        toolResults.push(...resultParts);
      }

      const toolContent: Content = {
        role: "user",
        parts: toolResults,
      };

      this.history.push(toolContent);
    }

    throw new Error(
      `Agent reached ${MAX_AGENT_STEPS} steps without finishing.`,
    );
  }

  private async runEnhancementPass(signal?: AbortSignal): Promise<void> {
    this.display.agentMessage(
      "Injecting expert visual design critic prompt for enhancement pass...",
    );

    let html = "";
    try {
      html = await this.registry.execute("read_file", {
        path: "output/index.html",
      });
    } catch {
      this.display.warn(
        "Enhancement pass failed: could not read output/index.html",
      );
      return;
    }

    const screenshotBase64 = this.extractLastScreenshot();

    const parts: Part[] = [
      {
        text: `${ENHANCEMENT_PROMPT}\n\nSemantic blueprint of the target site for structural reference:\n${this.latestBlueprint.slice(0, 3000)}`,
      },
    ];

    if (screenshotBase64) {
      parts.unshift({
        inlineData: { mimeType: "image/png", data: screenshotBase64 },
      });
    }

    this.history.push({ role: "user", parts });

    for (let step = 1; step <= 4; step += 1) {
      if (signal?.aborted) return;
      this.display.startSpinner(`enhancing step ${step}`);

      let response;
      try {
        response = await this.client.models.generateContent({
          model: this.model,
          contents: this.history.all(),
          config: {
            systemInstruction: SYSTEM_PROMPT,
            tools: [{ functionDeclarations: this.registry.schemas() }],
          },
        });
      } catch (error) {
        this.display.stopSpinner(false, "API call failed");
        return;
      }

      this.display.stopSpinner(true);

      const modelContent = response.candidates?.[0]?.content;
      if (modelContent) this.history.push(modelContent);

      const text = this.textFromContent(modelContent);
      if (text) this.display.agentMessage(text);

      const calls = response.functionCalls;
      if (!calls?.length) break;

      const toolResults: Part[] = [];

      for (const call of calls) {
        if (signal?.aborted) return;
        const args = call.args as Record<string, unknown> | undefined;
        this.display.toolCall(call.name ?? "unknown", args ?? {});

        let output = "";
        let success = true;

        try {
          if (call.name && PRE_JUDGED_TOOLS.has(call.name)) {
            const preResult = await this.judge.evaluatePre(
              call.name,
              args ?? {},
            );
            this.display.judgePreResult(
              call.name,
              preResult.passed,
              preResult.reason,
            );
            if (!preResult.passed) {
              success = false;
              output = `[PRE-EXECUTION JUDGE FAIL: ${preResult.reason}]`;
            }
          }

          if (success) {
            output = await this.registry.execute(call.name, args);
            this.display.toolResult(
              call.name ?? "unknown",
              true,
              output.slice(0, 100),
            );
          }
        } catch (error) {
          output = `Error: ${(error as Error).message}`;
          success = false;
          this.display.toolResult(call.name ?? "unknown", false, output);
        }

        if (success && call.name && JUDGED_TOOLS.has(call.name)) {
          const result = await this.judge.evaluate(call.name, output);
          this.display.judgeResult(result.passed, result.reason);
          if (!result.passed)
            output = `${output}\n\n[JUDGE FAIL: ${result.reason}]`;
        }

        toolResults.push({
          functionResponse: {
            name: call.name,
            response: { result: output },
          },
        });
      }

      this.history.push({ role: "user", parts: toolResults });
    }

    const validationError = await this.outputValidator.validate();
    if (validationError) {
      this.display.warn(
        `Enhancement pass validation failed: ${validationError}`,
      );
    } else {
      this.display.agentMessage("Enhancement pass complete.");
    }
  }

  private extractLastScreenshot(): string | undefined {
    const all = this.history.all();
    for (let i = all.length - 1; i >= 0; i--) {
      const parts = all[i].parts;
      if (!parts) continue;
      for (const part of parts) {
        if (part.inlineData && part.inlineData.mimeType === "image/png") {
          return part.inlineData.data;
        }
      }
    }
    return undefined;
  }

  private textFromContent(content: Content | undefined): string {
    return (
      content?.parts
        ?.map((part) => part.text)
        .filter((text): text is string => Boolean(text))
        .join("\n")
        .trim() ?? ""
    );
  }
}
