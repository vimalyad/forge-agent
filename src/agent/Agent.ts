import type { Content, GoogleGenAI, Part } from '@google/genai';
import { MAX_AGENT_STEPS, MODEL, SYSTEM_PROMPT } from '../config/constants.js';
import type { Display } from '../ui/Display.js';
import type { ToolRegistry } from '../tools/ToolRegistry.js';
import type { JudgeAgent } from './JudgeAgent.js';
import type { MessageHistory } from './MessageHistory.js';

const JUDGED_TOOLS = new Set(['write_file', 'web_fetch', 'read_file']);

export class Agent {
  constructor(
    private readonly client: GoogleGenAI,
    private readonly history: MessageHistory,
    private readonly registry: ToolRegistry,
    private readonly judge: JudgeAgent,
    private readonly display: Display,
  ) {}

  async run(userInput: string): Promise<void> {
    this.history.push({ role: 'user', parts: [{ text: userInput }] });

    for (let step = 1; step <= MAX_AGENT_STEPS; step += 1) {
      this.display.startSpinner(`thinking step ${step}`);

      let response;

      try {
        response = await this.client.models.generateContent({
          model: MODEL,
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
        return;
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
