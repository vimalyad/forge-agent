import Groq from 'groq-sdk';
import { GROQ_MODEL, MAX_AGENT_STEPS, SYSTEM_PROMPT } from '../config/constants.js';
import type { Display } from '../ui/Display.js';
import type { ToolRegistry } from '../tools/ToolRegistry.js';
import type { IAgent } from './IAgent.js';
import type { ToolJudge } from './ToolJudge.js';

type GroqMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
};

const JUDGED_TOOLS = new Set(['write_file', 'web_fetch', 'scrape_website', 'read_file']);

export class GroqAgent implements IAgent {
  private readonly messages: GroqMessage[] = [
    {
      role: 'system',
      content: SYSTEM_PROMPT,
    },
  ];

  constructor(
    private readonly client: Groq,
    private readonly registry: ToolRegistry,
    private readonly judge: ToolJudge,
    private readonly display: Display,
  ) {}

  async run(userInput: string): Promise<void> {
    this.messages.push({ role: 'user', content: userInput });

    for (let step = 1; step <= MAX_AGENT_STEPS; step += 1) {
      this.display.startSpinner(`thinking step ${step}`);

      let response;

      try {
        response = await this.client.chat.completions.create({
          model: GROQ_MODEL,
          messages: this.messages as never,
          tools: this.registry.groqTools() as never,
          tool_choice: 'auto',
        });
      } catch (error) {
        this.display.stopSpinner(false, 'API call failed');
        throw error;
      }

      this.display.stopSpinner(true);

      const message = response.choices[0]?.message;

      if (!message) {
        throw new Error('Groq returned no message.');
      }

      this.messages.push({
        role: 'assistant',
        content: message.content ?? null,
        tool_calls: message.tool_calls as GroqMessage['tool_calls'],
      });

      if (message.content) {
        this.display.agentMessage(message.content);
      }

      if (!message.tool_calls?.length) {
        return;
      }

      for (const call of message.tool_calls) {
        const args = this.parseArgs(call.function.arguments);
        this.display.toolCall(call.function.name, args);

        let output: string;
        let success = true;

        try {
          output = await this.registry.execute(call.function.name, args);
          this.display.toolResult(call.function.name, true, output.slice(0, 100));
        } catch (error) {
          output = `Error: ${(error as Error).message}`;
          success = false;
          this.display.toolResult(call.function.name, false, output);
        }

        if (success && JUDGED_TOOLS.has(call.function.name)) {
          const result = await this.judge.evaluate(call.function.name, output);
          this.display.judgeResult(result.passed, result.reason);

          if (!result.passed) {
            output = `${output}\n\n[JUDGE FAIL: ${result.reason}]`;
          }
        }

        this.messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: output,
        });
      }
    }

    throw new Error(`Agent reached ${MAX_AGENT_STEPS} steps without finishing.`);
  }

  private parseArgs(rawArgs: string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(rawArgs);
      return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
}
