import {
  DEFAULT_ANTHROPIC_CODE_MODEL,
  MAX_AGENT_STEPS,
  SYSTEM_PROMPT,
} from "../../config/constants.js";
import type { IAgent, AgentOptions } from "../../core/IAgent.js";
import type { MediaAssets } from "../../core/ITool.js";
import type { ToolJudge } from "../../core/ToolJudge.js";
import { FallbackPageFactory } from "../../services/FallbackPageFactory.js";
import { OutputValidator } from "../../services/OutputValidator.js";
import type { TaskRouter } from "../../services/TaskRouter.js";
import type { ToolRegistry } from "../../tools/ToolRegistry.js";
import type { Display } from "../../ui/Display.js";
import { openInBrowser } from "../../utils/openInBrowser.js";

const PRE_JUDGED_TOOLS = new Set(["write_file"]);
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | {
      type: "image";
      source: {
        type: "base64";
        media_type: "image/png";
        data: string;
      };
    };

type AnthropicResponse = {
  content?: { type: string; text?: string }[];
  error?: { message?: string };
};

type OpenRouterResponse = {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
};

export class AnthropicAgent implements IAgent {
  constructor(
    private readonly apiKey: string,
    private readonly registry: ToolRegistry,
    private readonly judge: ToolJudge,
    private readonly display: Display,
    private readonly outputValidator = new OutputValidator(),
    private readonly fallbackPageFactory = new FallbackPageFactory(),
    private readonly model = DEFAULT_ANTHROPIC_CODE_MODEL,
    private readonly router: TaskRouter,
  ) {}

  async run(
    userInput: string,
    signal?: AbortSignal,
    options?: AgentOptions,
  ): Promise<void> {
    const targetUrl = await this.resolveTargetUrl(userInput, signal);
    if (signal?.aborted) {
      throw Object.assign(new Error("Interrupted"), { name: "AbortError" });
    }
    this.display.agentMessage(`Target site identified: ${targetUrl}`);

    const scrapeResult = await this.executeJudgedToolRich("scrape_website", {
      url: targetUrl,
    });
    const blueprint = scrapeResult.text;
    const screenshotBase64 = scrapeResult.screenshotBase64;
    const mediaAssets = scrapeResult.mediaAssets;

    if (options?.dryRun) {
      console.log("\n--- DRY RUN BLUEPRINT ---");
      console.log(blueprint);
      this.display.agentMessage("Dry run complete. Exiting.");
      return;
    }

    let correction = "";

    for (let step = 1; step <= MAX_AGENT_STEPS; step += 1) {
      if (signal?.aborted) {
        throw Object.assign(new Error("Interrupted"), { name: "AbortError" });
      }
      this.display.startSpinner(`thinking step ${step}`);

      let html: string;
      try {
        html = await this.generateHtml(
          userInput,
          blueprint,
          correction,
          step,
          undefined,
          screenshotBase64,
          mediaAssets,
          signal,
        );
      } catch (error) {
        this.display.stopSpinner(false, "API call failed");
        throw error;
      }

      this.display.stopSpinner(true);

      const writeResult = await this.tryTool("write_file", {
        path: "output/index.html",
        content: html,
      });

      if (!writeResult.success) {
        correction = writeResult.output;
        if (step >= MAX_AGENT_STEPS) {
          this.display.warn(
            `Agent reached max steps (${MAX_AGENT_STEPS}) without passing validation. Keeping best attempt.`,
          );
          return;
        }
        continue;
      }

      await this.judgeTool("write_file", writeResult.output);
      const readResult = await this.tryTool("read_file", {
        path: "output/index.html",
      });

      if (!readResult.success) {
        correction = readResult.output;
        continue;
      }

      await this.judgeTool("read_file", readResult.output);
      const validationError = await this.outputValidator.validate();

      if (!validationError) {
        let currentHtml = readResult.output;
        const isFinalStep = step >= MAX_AGENT_STEPS - 1;

        if (!isFinalStep && process.env.OPENROUTER_API_KEY) {
          this.display.agentMessage(
            "Draft passed validation. Running final Anthropic output pass...",
          );
          this.display.startSpinner("finalizing with Anthropic");

          try {
            const finalHtml = await this.generateHtml(
              userInput,
              blueprint,
              "",
              MAX_AGENT_STEPS,
              readResult.output,
              screenshotBase64,
              mediaAssets,
              signal,
            );
            this.display.stopSpinner(true);

            const finalWrite = await this.tryTool("write_file", {
              path: "output/index.html",
              content: finalHtml,
            });

            if (!finalWrite.success) {
              correction = finalWrite.output;
              continue;
            }

            await this.judgeTool("write_file", finalWrite.output);
            currentHtml = finalHtml;
          } catch (error) {
            this.display.stopSpinner(false, "API call failed");
            throw error;
          }
        }

        if (options?.enhance) {
          this.display.agentMessage(
            "Injecting expert visual design critic prompt for enhancement pass...",
          );
          this.display.startSpinner("enhancing visual design");
          try {
            const enhancedHtml = await this.generateHtml(
              userInput,
              blueprint,
              "",
              MAX_AGENT_STEPS,
              currentHtml,
              screenshotBase64,
              mediaAssets,
              signal,
            );
            this.display.stopSpinner(true);
            const finalWrite = await this.tryTool("write_file", {
              path: "output/index.html",
              content: enhancedHtml,
            });
            if (!finalWrite.success) {
              this.display.warn("Enhancement pass write failed.");
            }
          } catch {
            this.display.stopSpinner(false, "API call failed");
            this.display.warn("Enhancement pass failed.");
          }
        } else {
          this.display.agentMessage(
            "Enhancement pass skipped. Use --enhance to run it.",
          );
        }

        this.display.agentMessage(
          "Generated output/index.html with a header, hero section, footer, embedded CSS, and JavaScript.",
        );
        openInBrowser("output/index.html");
        console.log("[agent] Preview opened. Generation complete.");
        return;
      }

      correction = validationError;
      if (step >= MAX_AGENT_STEPS) {
        this.display.warn(
          `Agent reached max steps (${MAX_AGENT_STEPS}) without passing validation. Keeping best attempt.`,
        );
        return;
      }
    }

    throw new Error(
      `Anthropic agent reached ${MAX_AGENT_STEPS} steps without producing a valid output/index.html.`,
    );
  }

  private async generateHtml(
    userInput: string,
    blueprint: string,
    correction: string,
    step: number,
    previousHtml?: string,
    screenshotBase64?: string,
    mediaAssets?: MediaAssets,
    signal?: AbortSignal,
  ): Promise<string> {
    const textBlocks: string[] = [];

    if (previousHtml) {
      textBlocks.push(
        `Previous attempt HTML (enhance this, do not start from scratch):\n<previous_attempt>\n${previousHtml.slice(0, 4000)}\n</previous_attempt>\n\nEnhancement instructions: Match hero background from screenshot exactly. Extract brand primary color and use as CSS variable. Add hover transitions to cards and buttons. Add IntersectionObserver fade-in. Add mobile nav toggle. Ensure footer background matches screenshot. Output must exceed 8000 characters.`,
      );
    } else {
      textBlocks.push(userInput);
    }

    if (screenshotBase64) {
      textBlocks.push(
        "The screenshot shows the live visual layout. Use it as the primary reference alongside the cleaned blueprint.",
      );
    }

    textBlocks.push("Cleaned website blueprint:");
    textBlocks.push(this.compactBlueprint(blueprint));

    if (mediaAssets) {
      textBlocks.push(this.formatMediaAssets(mediaAssets));
    }

    if (correction) {
      textBlocks.push(`Previous validation error: ${correction}`);
    }

    const content: AnthropicContentBlock[] = [];
    if (screenshotBase64) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: "image/png",
          data: screenshotBase64,
        },
      });
    }
    content.push({ type: "text", text: textBlocks.filter(Boolean).join("\n\n") });

    const system = [
      SYSTEM_PROMPT,
      "Return only the complete HTML document. Do not use Markdown fences.",
      "Write at least 6500 characters of real HTML/CSS/JS.",
      screenshotBase64
        ? "A screenshot of the target page is included in the user message. Use it as the primary visual reference for colours, layout, fonts, and spacing."
        : "Infer the visual style from the blueprint: match the colour palette, layout structure, and typography of the target site.",
      "Real media asset URLs have been extracted from the live page and are included in the user message. Use them directly with <img src>, CSS background-image, and <link> tags. Never use placeholder image services like picsum, placehold.it, or unsplash.",
      "Include header, hero, stats/highlights strip if present, key feature sections, and footer.",
      "Use plain text labels instead of emoji for nav and social links.",
    ].join("\n");

    const isFinalStep = step >= MAX_AGENT_STEPS - 1;
    const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;

    const text =
      isFinalStep || !hasOpenRouter
        ? await this.callAnthropic(this.model, system, content, 8192, signal)
        : await this.callOpenRouter(
            "qwen/qwen3-235b-a22b:free",
            system,
            content,
            8192,
            signal,
          );

    return this.extractHtml(text);
  }

  private async resolveTargetUrl(
    userInput: string,
    signal?: AbortSignal,
  ): Promise<string> {
    const explicit = this.extractUrl(userInput);
    if (explicit) {
      return explicit;
    }

    if (signal?.aborted) {
      throw Object.assign(new Error("Interrupted"), { name: "AbortError" });
    }
    this.display.startSpinner("resolving target site URL...");

    try {
      const route = this.router.resolve("url_resolve");
      const raw = await this.callOpenAICompatible(
        route,
        "You are a URL resolver. Given a user instruction about cloning or recreating a website, respond with ONLY the canonical homepage URL of the target site. No explanation, no markdown, no punctuation, just the URL.",
        userInput,
        80,
        signal,
      );
      const resolved = this.extractUrl(raw);
      this.display.stopSpinner(
        true,
        `resolved -> ${resolved ?? "(failed, using fallback)"}`,
      );
      return resolved ?? "https://www.google.com";
    } catch (error) {
      if ((error as { name?: string }).name === "AbortError") {
        throw error;
      }
      this.display.stopSpinner(false, "URL resolution failed, using fallback");
      return "https://www.google.com";
    }
  }

  private async executeJudgedToolRich(
    name: string,
    args: Record<string, unknown>,
  ) {
    this.display.toolCall(name, args);

    try {
      const result = await this.registry.executeRich(name, args);
      const detail = result.screenshotBase64
        ? `scraped + screenshot captured (${Math.round((result.screenshotBase64.length * 0.75) / 1024)}kb PNG)`
        : result.text.slice(0, 100);
      this.display.toolResult(name, true, detail);

      const judgeResult = await this.judge.evaluate(name, result.text);
      this.display.judgeResult(judgeResult.passed, judgeResult.reason);

      return result;
    } catch (error) {
      const output = `Error: ${(error as Error).message}`;
      this.display.toolResult(name, false, output);
      throw new Error(output);
    }
  }

  private async tryTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<{ success: boolean; output: string }> {
    this.display.toolCall(name, args);

    if (PRE_JUDGED_TOOLS.has(name)) {
      const preResult = await this.judge.evaluatePre(name, args);
      this.display.judgePreResult(name, preResult.passed, preResult.reason);

      if (!preResult.passed) {
        const output = `[PRE-EXECUTION JUDGE FAIL: ${preResult.reason}]`;
        this.display.toolResult(name, false, output);
        return { success: false, output };
      }
    }

    try {
      const output = await this.registry.execute(name, args);
      this.display.toolResult(name, true, output.slice(0, 100));
      return { success: true, output };
    } catch (error) {
      const output = `Error: ${(error as Error).message}`;
      this.display.toolResult(name, false, output);
      return { success: false, output };
    }
  }

  private async judgeTool(name: string, output: string): Promise<void> {
    const result = await this.judge.evaluate(name, output);
    this.display.judgeResult(result.passed, result.reason);
  }

  private async callAnthropic(
    model: string,
    system: string,
    content: AnthropicContentBlock[],
    maxTokens: number,
    signal?: AbortSignal,
  ): Promise<string> {
    const response = await fetch(ANTHROPIC_API_URL, {
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
      throw new Error(data.error?.message ?? `Anthropic API request failed with status ${response.status}`);
    }

    return (
      data.content
        ?.filter((block) => block.type === "text" && block.text)
        .map((block) => block.text)
        .join("\n")
        .trim() ?? ""
    );
  }

  private async callOpenRouter(
    model: string,
    system: string,
    content: AnthropicContentBlock[],
    maxTokens: number,
    signal?: AbortSignal,
  ): Promise<string> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY not set");
    }

    const messages = [
      {
        role: "user",
        content: content.map((block) =>
          block.type === "image"
            ? {
                type: "image_url",
                image_url: {
                  url: `data:image/png;base64,${block.source.data}`,
                },
              }
            : { type: "text", text: block.text },
        ),
      },
    ];

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://github.com/forge-agent",
          "X-Title": "forge-agent",
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          messages,
          system,
        }),
      },
    );

    const data = (await response.json()) as OpenRouterResponse;
    if (!response.ok || data.error) {
      throw new Error(
        data.error?.message ??
          `OpenRouter API request failed with status ${response.status}`,
      );
    }

    return data.choices?.[0]?.message?.content?.trim() ?? "";
  }

  private async callOpenAICompatible(
    route: ReturnType<TaskRouter["resolve"]>,
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
        "HTTP-Referer": "https://github.com/forge-agent",
        "X-Title": "forge-agent",
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

    const data = (await response.json()) as OpenRouterResponse;
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

  private extractHtml(text: string): string {
    const fenced = text.match(/```(?:html)?\s*([\s\S]*?)```/i)?.[1];
    const candidate = fenced ?? text;
    const start = candidate.search(/<!doctype html>|<html/i);

    return start >= 0 ? candidate.slice(start).trim() : candidate.trim();
  }

  private extractUrl(text: string): string | null {
    return text.match(/https?:\/\/[^\s)"']+/i)?.[0] ?? null;
  }

  private formatMediaAssets(assets: MediaAssets | undefined): string {
    if (!assets) {
      return "";
    }
    const lines = [
      "\n--- REAL MEDIA ASSETS FROM THE LIVE PAGE ---",
      "Use these URLs directly in your HTML. Do not invent or placeholder any images, fonts, or icons.",
      "",
    ];
    if (assets.logos.length) {
      lines.push('LOGO (use in <header> as <img src="...">):');
      assets.logos.slice(0, 2).forEach((logo) => lines.push(`  ${logo.src}`));
    }
    if (assets.heroImages.length) {
      lines.push("\nHERO / ABOVE-FOLD IMAGES:");
      assets.heroImages
        .slice(0, 4)
        .forEach((image) =>
          lines.push(`  ${image.src}  [${image.width}px wide, alt="${image.alt}"]`),
        );
    }
    if (assets.backgroundImages.length) {
      lines.push("\nBACKGROUND IMAGES (use in CSS background-image):");
      assets.backgroundImages.slice(0, 3).forEach((url) => lines.push(`  ${url}`));
    }
    if (assets.fontLinks.length) {
      lines.push("\nFONT STYLESHEETS (add as <link> in <head>):");
      assets.fontLinks.forEach((url) => lines.push(`  ${url}`));
    }
    if (assets.icons.length) {
      lines.push("\nFAVICON:");
      lines.push(`  ${assets.icons[0]}`);
    }
    lines.push("--- END MEDIA ASSETS ---\n");
    return lines.join("\n");
  }

  private compactBlueprint(blueprint: string): string {
    const importantLines = blueprint.split("\n").filter((line) => {
      const lower = line.toLowerCase();

      return [
        "source:",
        "url:",
        "title:",
        "description:",
        "h1:",
        "h2:",
        "h3:",
        "header",
        "nav",
        "hero",
        "footer",
        "section",
        "feature",
        "pricing",
        "cta",
        "button",
        "link",
        "class=",
        "classes=",
        "background",
        "gradient",
        "color",
        "font",
        "weight",
        "dark",
        "light",
        "primary",
        "secondary",
        "accent",
      ].some((signal) => lower.includes(signal));
    });

    const compact = importantLines.join("\n").replace(/\n{3,}/g, "\n\n");
    return (compact || blueprint).slice(0, 3500);
  }
}
