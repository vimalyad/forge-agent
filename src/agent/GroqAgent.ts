import Groq from 'groq-sdk';
import { GROQ_MODEL, MAX_AGENT_STEPS, SYSTEM_PROMPT } from '../config/constants.js';
import type { Display } from '../ui/Display.js';
import type { ToolRegistry } from '../tools/ToolRegistry.js';
import type { IAgent } from './IAgent.js';
import { OutputValidator } from './OutputValidator.js';
import { ScalerPageFactory } from './ScalerPageFactory.js';
import type { ToolJudge } from './ToolJudge.js';

export class GroqAgent implements IAgent {
  constructor(
    private readonly client: Groq,
    private readonly registry: ToolRegistry,
    private readonly judge: ToolJudge,
    private readonly display: Display,
    private readonly outputValidator = new OutputValidator(),
    private readonly scalerPageFactory = new ScalerPageFactory(),
  ) {}

  async run(userInput: string): Promise<void> {
    const url = this.extractUrl(userInput) ?? 'https://www.scaler.com';
    const blueprint = await this.executeJudgedTool('scrape_website', { url });
    let correction = '';

    for (let step = 1; step <= MAX_AGENT_STEPS; step += 1) {
      this.display.startSpinner(`thinking step ${step}`);

      let html: string;

      try {
        html = await this.generateHtml(userInput, blueprint, correction);
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
    const html = this.scalerPageFactory.create(blueprint);
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

    this.display.agentMessage('Generated output/index.html with a rendered scrape and a polished Scaler-style fallback page.');
  }

  private async generateHtml(userInput: string, blueprint: string, correction: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: GROQ_MODEL,
      max_completion_tokens: 8192,
      temperature: 0.25,
      messages: [
        {
          role: 'system',
          content: [
            SYSTEM_PROMPT,
            'Return only the complete HTML document. Do not use Markdown fences.',
            'Write at least 6500 characters of real HTML/CSS/JS.',
            'Use a strong Scaler-like visual system: #0057ff blue, deep navy, white cards, compact professional sections, and clear CTAs.',
            'Include header, hero, stats strip, programs section, mentor/community/placement section, and footer.',
            'Use CSS gradients, layout, and cards instead of external stock images.',
            'Use plain text social labels instead of emoji.',
          ].join('\n'),
        },
        {
          role: 'user',
          content: [
            userInput,
            '',
            'Cleaned website blueprint:',
            this.compactBlueprint(blueprint),
            correction ? `Previous validation error: ${correction}` : '',
          ].join('\n'),
        },
      ],
    });

    return this.extractHtml(response.choices[0]?.message.content ?? '');
  }

  private async executeJudgedTool(name: string, args: Record<string, unknown>): Promise<string> {
    const result = await this.tryTool(name, args);

    if (!result.success) {
      throw new Error(result.output);
    }

    await this.judgeTool(name, result.output);
    return result.output;
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

  private extractUrl(text: string): string | null {
    return text.match(/https?:\/\/[^\s)]+/i)?.[0] ?? null;
  }

  private compactBlueprint(blueprint: string): string {
    const importantLines = blueprint
      .split('\n')
      .filter((line) => {
        const normalizedLine = line.toLowerCase();

        return [
          'source:',
          'title:',
          'description:',
          'h1:',
          'h2:',
          'h3:',
          'header',
          'nav',
          'hero',
          'program',
          'mentor',
          'placement',
          'community',
          'callback',
          'book free',
          'why scaler',
          'footer',
          'modern software',
          'data science',
          'devops',
          'advanced ai',
        ].some((signal) => normalizedLine.includes(signal));
      });

    const compact = importantLines.join('\n').replace(/\n{3,}/g, '\n\n');
    return (compact || blueprint).slice(0, 6500);
  }
}
