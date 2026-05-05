import {
  DEFAULT_ANTHROPIC_CODE_MODEL,
  MAX_AGENT_STEPS,
} from "../../config/constants.js";
import {
  DRAFT_HTML_MODELS,
  HTML_MAX_TOKENS,
  FINAL_HTML_MAX_TOKENS,
  OUTPUT_FILE_PATH,
  PRE_JUDGED_TOOLS,
  URL_RESOLVE_MAX_TOKENS,
} from "../../config/modelRuntime.js";
import type { IAgent, AgentOptions } from "../../core/IAgent.js";
import type { MediaAssets } from "../../core/ITool.js";
import type { ToolJudge } from "../../core/ToolJudge.js";
import { AnthropicMessagesClient } from "../../services/AnthropicMessagesClient.js";
import { OpenAICompatibleClient } from "../../services/OpenAICompatibleClient.js";
import { OpenRouterChatClient } from "../../services/OpenRouterChatClient.js";
import { OutputValidator } from "../../services/OutputValidator.js";
import type { TaskRouter } from "../../services/TaskRouter.js";
import type { ToolRegistry } from "../../tools/ToolRegistry.js";
import type { Display } from "../../ui/Display.js";
import { openInBrowser } from "../../utils/openInBrowser.js";
import { HtmlGenerationPromptBuilder } from "./HtmlGenerationPromptBuilder.js";

type ScrapedPageContext = {
  blueprint: string;
  screenshotBase64?: string;
  mediaAssets?: MediaAssets;
};

type ToolAttempt = {
  success: boolean;
  output: string;
};

export class AnthropicAgent implements IAgent {
  private readonly anthropicClient: AnthropicMessagesClient;
  private readonly openRouterClient: OpenRouterChatClient;
  private readonly openAICompatibleClient: OpenAICompatibleClient;

  constructor(
    apiKey: string,
    private readonly registry: ToolRegistry,
    private readonly judge: ToolJudge,
    private readonly display: Display,
    private readonly outputValidator = new OutputValidator(),
    private readonly model = DEFAULT_ANTHROPIC_CODE_MODEL,
    private readonly router: TaskRouter,
    private readonly promptBuilder = new HtmlGenerationPromptBuilder(),
  ) {
    this.anthropicClient = new AnthropicMessagesClient(apiKey);
    this.openRouterClient = new OpenRouterChatClient(
      process.env.OPENROUTER_API_KEY,
    );
    this.openAICompatibleClient = new OpenAICompatibleClient(router);
  }

  async run(
    userInput: string,
    signal?: AbortSignal,
    options?: AgentOptions,
  ): Promise<void> {
    const targetUrl = await this.resolveTargetUrl(userInput, signal);
    this.throwIfAborted(signal);
    this.display.agentMessage(`Target site identified: ${targetUrl}`);

    const pageContext = await this.scrapeTarget(targetUrl);

    if (options?.dryRun) {
      console.log("\n--- DRY RUN BLUEPRINT ---");
      console.log(pageContext.blueprint);
      this.display.agentMessage("Dry run complete. Exiting.");
      return;
    }

    await this.generateUntilValid(userInput, pageContext, signal, options);
  }

  private async generateUntilValid(
    userInput: string,
    pageContext: ScrapedPageContext,
    signal?: AbortSignal,
    options?: AgentOptions,
  ): Promise<void> {
    let correction = "";

    for (let step = 1; step <= MAX_AGENT_STEPS; step += 1) {
      this.throwIfAborted(signal);

      const html = await this.runGenerationStep(
        userInput,
        pageContext,
        correction,
        step,
        undefined,
        signal,
      );

      const writeResult = await this.writeOutput(html);
      if (!writeResult.success) {
        correction = writeResult.output;
        if (this.hasReachedMaxSteps(step)) return;
        continue;
      }

      const readResult = await this.readOutput();
      if (!readResult.success) {
        correction = readResult.output;
        continue;
      }

      const validationError = await this.outputValidator.validate();
      if (validationError) {
        correction = validationError;
        if (this.hasReachedMaxSteps(step)) return;
        continue;
      }

      await this.finishSuccessfulRun(
        userInput,
        pageContext,
        readResult.output,
        step,
        signal,
        options,
      );
      return;
    }

    throw new Error(
      `Anthropic agent reached ${MAX_AGENT_STEPS} steps without producing a valid ${OUTPUT_FILE_PATH}.`,
    );
  }

  private async finishSuccessfulRun(
    userInput: string,
    pageContext: ScrapedPageContext,
    validatedHtml: string,
    step: number,
    signal?: AbortSignal,
    options?: AgentOptions,
  ): Promise<void> {
    let currentHtml = validatedHtml;

    if (
      !this.isFinalGenerationStep(step) &&
      this.openRouterClient.hasApiKey()
    ) {
      currentHtml = await this.runFinalAnthropicPass(
        userInput,
        pageContext,
        validatedHtml,
        signal,
      );
    }

    if (options?.enhance) {
      await this.runEnhancementPass(
        userInput,
        pageContext,
        currentHtml,
        signal,
      );
    } else {
      this.display.agentMessage(
        "Enhancement pass skipped. Use --enhance to run it.",
      );
    }

    this.display.agentMessage(
      `Generated ${OUTPUT_FILE_PATH} with a header, hero section, footer, embedded CSS, and JavaScript.`,
    );
    openInBrowser(OUTPUT_FILE_PATH);
    console.log("[agent] Preview opened. Generation complete.");
  }

  private async runGenerationStep(
    userInput: string,
    pageContext: ScrapedPageContext,
    correction: string,
    step: number,
    previousHtml?: string,
    signal?: AbortSignal,
  ): Promise<string> {
    this.display.startSpinner(`thinking step ${step}`);

    try {
      const html = await this.generateHtml(
        userInput,
        pageContext,
        correction,
        step,
        previousHtml,
        signal,
      );
      this.display.stopSpinner(true);
      return html;
    } catch (error) {
      this.display.stopSpinner(false, "API call failed");
      throw error;
    }
  }

  private async runFinalAnthropicPass(
    userInput: string,
    pageContext: ScrapedPageContext,
    previousHtml: string,
    signal?: AbortSignal,
  ): Promise<string> {
    this.display.agentMessage(
      "Draft passed validation. Running final Anthropic output pass...",
    );

    const finalHtml = await this.runGenerationStep(
      userInput,
      pageContext,
      "",
      MAX_AGENT_STEPS,
      previousHtml,
      signal,
    );
    const finalWrite = await this.writeOutput(finalHtml);

    if (!finalWrite.success) {
      throw new Error(finalWrite.output);
    }

    return finalHtml;
  }

  private async runEnhancementPass(
    userInput: string,
    pageContext: ScrapedPageContext,
    previousHtml: string,
    signal?: AbortSignal,
  ): Promise<void> {
    this.display.agentMessage(
      "Injecting expert visual design critic prompt for enhancement pass...",
    );

    try {
      const enhancedHtml = await this.runGenerationStep(
        userInput,
        pageContext,
        "",
        MAX_AGENT_STEPS,
        previousHtml,
        signal,
      );
      const finalWrite = await this.writeOutput(enhancedHtml);
      if (!finalWrite.success) {
        this.display.warn("Enhancement pass write failed.");
      }
    } catch {
      this.display.warn("Enhancement pass failed.");
    }
  }

  private async generateHtml(
    userInput: string,
    pageContext: ScrapedPageContext,
    correction: string,
    step: number,
    previousHtml?: string,
    signal?: AbortSignal,
  ): Promise<string> {
    const prompt = this.promptBuilder.build({
      userInput,
      blueprint: pageContext.blueprint,
      correction,
      previousHtml,
      screenshotBase64: pageContext.screenshotBase64,
      mediaAssets: pageContext.mediaAssets,
    });
    const textOnlyContent = prompt.content.filter(
      (block) => block.type !== "image",
    );

    const isFinalStep = this.isFinalGenerationStep(step);
    const systemPrompt = isFinalStep
      ? prompt.system + "\n\nCRITICAL: You MUST close every HTML tag properly. Always end your response with </body></html>. Do not truncate. If content is long, simplify sections but always produce complete valid HTML."
      : prompt.system;

    const text =
      isFinalStep || !this.openRouterClient.hasApiKey()
        ? await this.anthropicClient.createMessage(
            this.model,
            systemPrompt,
            prompt.content,
            isFinalStep ? FINAL_HTML_MAX_TOKENS : HTML_MAX_TOKENS,
            signal,
          )
        : await this.openRouterClient.createCompletion(
            DRAFT_HTML_MODELS,
            systemPrompt,
            textOnlyContent,
            HTML_MAX_TOKENS,
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

    this.throwIfAborted(signal);
    this.display.startSpinner("resolving target site URL...");

    try {
      const route = this.router.resolve("url_resolve");
      const raw = await this.openAICompatibleClient.createTextCompletion(
        route,
        "You are a URL resolver. Given a user instruction about cloning or recreating a website, respond with ONLY the canonical homepage URL of the target site. No explanation, no markdown, no punctuation, just the URL.",
        userInput,
        URL_RESOLVE_MAX_TOKENS,
        signal,
      );
      const resolved = this.extractUrl(raw);
      this.display.stopSpinner(
        true,
        `resolved -> ${resolved ?? "(failed, using fallback)"}`,
      );
      return resolved ?? "https://www.google.com";
    } catch (error) {
      if ((error as { name?: string }).name === "AbortError") throw error;
      this.display.stopSpinner(false, "URL resolution failed, using fallback");
      return "https://www.google.com";
    }
  }

  private async scrapeTarget(url: string): Promise<ScrapedPageContext> {
    const result = await this.executeJudgedToolRich("scrape_website", { url });

    return {
      blueprint: result.text,
      screenshotBase64: result.screenshotBase64,
      mediaAssets: result.mediaAssets,
    };
  }

  private async writeOutput(html: string): Promise<ToolAttempt> {
    const result = await this.tryTool("write_file", {
      path: OUTPUT_FILE_PATH,
      content: html,
    });

    if (result.success) {
      await this.judgeTool("write_file", result.output);
    }

    return result;
  }

  private async readOutput(): Promise<ToolAttempt> {
    const result = await this.tryTool("read_file", {
      path: OUTPUT_FILE_PATH,
    });

    if (result.success) {
      await this.judgeTool("read_file", result.output);
    }

    return result;
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
  ): Promise<ToolAttempt> {
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

  private hasReachedMaxSteps(step: number): boolean {
    if (step < MAX_AGENT_STEPS) {
      return false;
    }

    this.display.warn(
      `Agent reached max steps (${MAX_AGENT_STEPS}) without passing validation. Keeping best attempt.`,
    );
    return true;
  }

  private isFinalGenerationStep(step: number): boolean {
    return step === MAX_AGENT_STEPS;
  }

  private throwIfAborted(signal?: AbortSignal): void {
    if (signal?.aborted) {
      throw Object.assign(new Error("Interrupted"), { name: "AbortError" });
    }
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
}
