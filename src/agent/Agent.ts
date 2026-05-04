import type { Content, GoogleGenAI, Part } from '@google/genai';
import { DEFAULT_GEMINI_MODEL, MAX_AGENT_STEPS, SYSTEM_PROMPT } from '../config/constants.js';
import type { Display } from '../ui/Display.js';
import type { ToolRegistry } from '../tools/ToolRegistry.js';
import type { IAgent } from './IAgent.js';
import type { MessageHistory } from './MessageHistory.js';
import { OutputValidator } from './OutputValidator.js';
import type { ToolJudge } from './ToolJudge.js';

const JUDGED_TOOLS = new Set(['write_file', 'web_fetch', 'scrape_website', 'read_file']);

export class Agent implements IAgent {
  constructor(
    private readonly client: GoogleGenAI,
    private readonly history: MessageHistory,
    private readonly registry: ToolRegistry,
    private readonly judge: ToolJudge,
    private readonly display: Display,
    private readonly outputValidator = new OutputValidator(),
    private readonly model = DEFAULT_GEMINI_MODEL,
  ) {}

  async run(userInput: string): Promise<void> {
    this.history.push({ role: 'user', parts: [{ text: userInput }] });

    for (let step = 1; step <= MAX_AGENT_STEPS; step += 1) {
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
        this.display.stopSpinner(false, 'API call failed');
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
          return;
        }

        this.history.push({
          role: 'user',
          parts: [{ text: `Final output validation failed: ${validationError} Continue and fix output/index.html before claiming completion.` }],
        });
        continue;
      }

      const toolResults: Part[] = [];

      for (const call of calls) {
        const args = call.args as Record<string, unknown> | undefined;
        this.display.toolCall(call.name ?? 'unknown', args ?? {});

        let output: string;
        let success = true;

        try {
          output = await this.registry.execute(call.name, args);
          this.display.toolResult(call.name ?? 'unknown', true, output.slice(0, 100));
        } catch (error) {
          output = `Error: ${(error as Error).message}`;
          success = false;
          this.display.toolResult(call.name ?? 'unknown', false, output);
        }

        if (success && call.name && JUDGED_TOOLS.has(call.name)) {
          const result = await this.judge.evaluate(call.name, output);
          this.display.judgeResult(result.passed, result.reason);

          if (!result.passed) {
            output = `${output}\n\n[JUDGE FAIL: ${result.reason}]`;
          }
        }

        toolResults.push({
          functionResponse: {
            name: call.name,
            response: { result: output },
          },
        });
      }

      const toolContent: Content = {
        role: 'user',
        parts: toolResults,
      };

      this.history.push(toolContent);
    }

    throw new Error(`Agent reached ${MAX_AGENT_STEPS} steps without finishing.`);
  }

  private textFromContent(content: Content | undefined): string {
    return content?.parts
      ?.map((part) => part.text)
      .filter((text): text is string => Boolean(text))
      .join('\n')
      .trim() ?? '';
  }
}
