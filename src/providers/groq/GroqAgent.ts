import Groq from 'groq-sdk';
import type { ChatCompletionContentPart } from 'groq-sdk/resources/chat/completions.js';
import { DEFAULT_GROQ_MODEL, MAX_AGENT_STEPS, SYSTEM_PROMPT } from '../../config/constants.js';
import type { Display } from '../../ui/Display.js';
import type { ToolRegistry } from '../../tools/ToolRegistry.js';
import type { IAgent } from '../../core/IAgent.js';
import { OutputValidator } from '../../services/OutputValidator.js';
import { FallbackPageFactory } from '../../services/FallbackPageFactory.js';
import type { ToolJudge } from '../../core/ToolJudge.js';

export class GroqAgent implements IAgent {
  constructor(
    private readonly client: Groq,
    private readonly registry: ToolRegistry,
    private readonly judge: ToolJudge,
    private readonly display: Display,
    private readonly outputValidator = new OutputValidator(),
    private readonly fallbackPageFactory = new FallbackPageFactory(),
    private readonly model = DEFAULT_GROQ_MODEL,
  ) {}

  async run(userInput: string, signal?: AbortSignal): Promise<void> {
    const targetUrl = await this.resolveTargetUrl(userInput, signal);
    if (signal?.aborted) throw Object.assign(new Error('Interrupted'), { name: 'AbortError' });
    this.display.agentMessage(`Target site identified: ${targetUrl}`);

    const scrapeResult = await this.executeJudgedToolRich('scrape_website', { url: targetUrl });
    const blueprint = scrapeResult.text;
    const screenshotBase64 = scrapeResult.screenshotBase64;
    let correction = '';

    for (let step = 1; step <= MAX_AGENT_STEPS; step += 1) {
      if (signal?.aborted) throw Object.assign(new Error('Interrupted'), { name: 'AbortError' });
      this.display.startSpinner(`thinking step ${step}`);

      let html: string;

      try {
        html = await this.generateHtml(userInput, blueprint, correction, screenshotBase64);
      } catch (error) {
        this.display.stopSpinner(false, 'API call failed');
        throw error;
      }

      this.display.stopSpinner(true);

      const writeResult = await this.tryTool('write_file', {
        path: 'output/index.html',
        content: html,
      });

      if (!writeResult.success) {
        correction = writeResult.output;

        if (step >= 3) {
          await this.writeFallbackPage(blueprint);
          return;
        }

        continue;
      }

      await this.judgeTool('write_file', writeResult.output);
      const readResult = await this.tryTool('read_file', { path: 'output/index.html' });

      if (!readResult.success) {
        correction = readResult.output;
        continue;
      }

      await this.judgeTool('read_file', readResult.output);

      const validationError = await this.outputValidator.validate();

      if (!validationError) {
        this.display.agentMessage('Generated output/index.html with a header, hero section, footer, embedded CSS, and JavaScript.');
        return;
      }

      correction = validationError;

      if (step >= 3) {
        await this.writeFallbackPage(blueprint);
        return;
      }
    }

    throw new Error(`Groq agent reached ${MAX_AGENT_STEPS} steps without producing a valid output/index.html.`);
  }

  private async writeFallbackPage(blueprint: string): Promise<void> {
    const html = this.fallbackPageFactory.create(blueprint);
    const writeResult = await this.tryTool('write_file', {
      path: 'output/index.html',
      content: html,
    });

    if (!writeResult.success) {
      throw new Error(writeResult.output);
    }

    await this.judgeTool('write_file', writeResult.output);
    const readResult = await this.tryTool('read_file', { path: 'output/index.html' });

    if (!readResult.success) {
      throw new Error(readResult.output);
    }

    await this.judgeTool('read_file', readResult.output);
    const validationError = await this.outputValidator.validate();

    if (validationError) {
      throw new Error(validationError);
    }

    this.display.agentMessage('Generated output/index.html with a rendered scrape and a polished fallback page.');
  }

  private async generateHtml(
    userInput: string,
    blueprint: string,
    correction: string,
    screenshotBase64?: string,
  ): Promise<string> {
    const userContent: ChatCompletionContentPart[] = [];

    // If we have a screenshot, prepend it as a vision context frame
    if (screenshotBase64) {
      userContent.push({
        type: 'image_url',
        image_url: { url: `data:image/png;base64,${screenshotBase64}` },
      });
    }

    userContent.push({
      type: 'text',
      text: [
        userInput,
        '',
        screenshotBase64
          ? 'The screenshot above shows the live visual layout of the page. Use it as a visual reference alongside the cleaned blueprint below.'
          : '',
        'Cleaned website blueprint:',
        this.compactBlueprint(blueprint),
        correction ? `Previous validation error: ${correction}` : '',
      ].filter(Boolean).join('\n'),
    });

    const response = await this.client.chat.completions.create({
      model: this.model,
      max_completion_tokens: 8192,
      temperature: 0.25,
      messages: [
        {
          role: 'system',
          content: [
            SYSTEM_PROMPT,
            'Return only the complete HTML document. Do not use Markdown fences.',
            'Write at least 6500 characters of real HTML/CSS/JS.',
            screenshotBase64
              ? 'A screenshot of the target page is included in the user message. Use it as the primary visual reference for colours, layout, fonts, and spacing.'
              : 'Infer the visual style from the blueprint: match the colour palette, layout structure, and typography of the target site.',
            'Include header, hero, stats/highlights strip (if present on the target), key feature sections, and footer.',
            'Use CSS gradients, flexbox/grid, and cards to match the target layout. Avoid external image dependencies.',
            'Use plain text labels instead of emoji for nav and social links.',
          ].join('\n'),
        },
        {
          role: 'user',
          content: userContent,
        },
      ],
    });

    return this.extractHtml(response.choices[0]?.message.content ?? '');
  }

  private async executeJudgedToolRich(name: string, args: Record<string, unknown>) {
    this.display.toolCall(name, args);

    let result;

    try {
      result = await this.registry.executeRich(name, args);

      const detail = result.screenshotBase64
        ? `scraped + screenshot captured (${Math.round(result.screenshotBase64.length * 0.75 / 1024)}kb PNG)`
        : result.text.slice(0, 100);

      this.display.toolResult(name, true, detail);
    } catch (error) {
      const output = `Error: ${(error as Error).message}`;
      this.display.toolResult(name, false, output);
      throw new Error(output);
    }

    const judgeResult = await this.judge.evaluate(name, result.text);
    this.display.judgeResult(judgeResult.passed, judgeResult.reason);

    return result;
  }

  private async executeJudgedTool(name: string, args: Record<string, unknown>): Promise<string> {
    return (await this.executeJudgedToolRich(name, args)).text;
  }

  private async tryTool(name: string, args: Record<string, unknown>): Promise<{ success: boolean; output: string }> {
    this.display.toolCall(name, args);

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

  private extractHtml(text: string): string {
    const fenced = text.match(/```(?:html)?\s*([\s\S]*?)```/i)?.[1];
    const candidate = fenced ?? text;
    const start = candidate.search(/<!doctype html>|<html/i);

    return start >= 0 ? candidate.slice(start).trim() : candidate.trim();
  }

  /**
   * Resolve the canonical URL of the site the user wants to clone.
   * 1. If the instruction already contains an https?:// URL, use it directly.
   * 2. Otherwise ask the model for the canonical homepage URL.
   */
  private async resolveTargetUrl(userInput: string, signal?: AbortSignal): Promise<string> {
    const explicit = this.extractUrl(userInput);

    if (explicit) {
      return explicit;
    }

    if (signal?.aborted) throw Object.assign(new Error('Interrupted'), { name: 'AbortError' });
    this.display.startSpinner('resolving target site URL…');

    try {
      const response = await this.client.chat.completions.create({
        model: 'llama-3.3-70b-versatile', // fast, cheap call
        max_completion_tokens: 60,
        temperature: 0,
        messages: [
          {
            role: 'system',
            content:
              'You are a URL resolver. ' +
              'Given a user instruction about cloning or recreating a website, ' +
              'respond with ONLY the canonical homepage URL of the target site ' +
              '(e.g. https://openai.com). ' +
              'No explanation, no markdown, no punctuation — just the URL.',
          },
          { role: 'user', content: userInput },
        ],
      });

      if (signal?.aborted) throw Object.assign(new Error('Interrupted'), { name: 'AbortError' });
      const raw = response.choices[0]?.message.content?.trim() ?? '';
      const resolved = this.extractUrl(raw);
      this.display.stopSpinner(true, `resolved → ${resolved ?? '(failed, using fallback)'}`);
      return resolved ?? 'https://www.google.com';
    } catch (error) {
      if ((error as { name?: string }).name === 'AbortError') throw error;
      this.display.stopSpinner(false, 'URL resolution failed — using fallback');
      return 'https://www.google.com';
    }
  }

  private extractUrl(text: string): string | null {
    return text.match(/https?:\/\/[^\s)"']+/i)?.[0] ?? null;
  }

  private compactBlueprint(blueprint: string): string {
    // Keep structurally significant lines — generic signals work for any site
    const importantLines = blueprint
      .split('\n')
      .filter((line) => {
        const l = line.toLowerCase();

        return [
          'source:', 'url:', 'title:', 'description:',
          'h1:', 'h2:', 'h3:',
          'header', 'nav', 'hero', 'footer',
          'section', 'feature', 'pricing', 'cta',
          'button', 'link',
        ].some((signal) => l.includes(signal));
      });

    const compact = importantLines.join('\n').replace(/\n{3,}/g, '\n\n');
    return (compact || blueprint).slice(0, 6500);
  }
}
