import 'dotenv/config';
import readline from 'node:readline';
import { GoogleGenAI } from '@google/genai';
import Groq from 'groq-sdk';
import { Agent } from './agent/Agent.js';
import { GroqAgent } from './agent/GroqAgent.js';
import { GroqJudgeAgent } from './agent/GroqJudgeAgent.js';
import type { IAgent } from './agent/IAgent.js';
import { JudgeAgent } from './agent/JudgeAgent.js';
import { MessageHistory } from './agent/MessageHistory.js';
import { DEFAULT_MODEL_OPTION, MODEL_OPTIONS, type ModelOption } from './config/models.js';
import { Display } from './ui/Display.js';
import { pickModel } from './ui/ModelPicker.js';
import { ListFilesTool } from './tools/ListFilesTool.js';
import { ReadFileTool } from './tools/ReadFileTool.js';
import { ScrapeWebsiteTool } from './tools/ScrapeWebsiteTool.js';
import { ToolRegistry } from './tools/ToolRegistry.js';
import { WebFetchTool } from './tools/WebFetchTool.js';
import { WriteFileTool } from './tools/WriteFileTool.js';

async function main(): Promise<void> {
  const display = new Display();

  display.banner();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  let closed = false;

  rl.on('close', () => {
    closed = true;
  });

  let currentModel = DEFAULT_MODEL_OPTION;
  let agent = createAgent(currentModel, display);

  display.modelStatus(currentModel.label, currentModel.provider);

  const ask = (): void => {
    if (closed) {
      return;
    }

    rl.question(display.prompt(), async (input) => {
      const instruction = input.trim();

      if (!instruction) {
        ask();
        return;
      }

      if (instruction.toLowerCase() === 'exit') {
        console.log('\n  Goodbye.\n');
        rl.close();
        return;
      }

      const ac = new AbortController();

      // Listen for ESC (0x1b), Ctrl+C (0x03), or 'q' to abort
      const onKeypress = (chunk: Buffer) => {
        const key = chunk.toString();
        if (key === '\x1b' || key === '\x03' || key.toLowerCase() === 'q') {
          ac.abort();
        }
      };

      process.stdin.on('data', onKeypress);
      if (process.stdin.isTTY) process.stdin.setRawMode(true);

      try {
        await runWithModelRecovery(
          instruction,
          {
            getAgent: () => agent,
            getCurrentModel: () => currentModel,
            setModel: (nextModel) => {
              currentModel = nextModel;
              agent = createAgent(currentModel, display);
            },
            display,
          },
          ac.signal,
        );
      } catch (error) {
        if ((error as { name?: string }).name === 'AbortError') {
          display.interrupted();
        } else {
          display.error((error as Error).message);
        }
      } finally {
        process.stdin.off('data', onKeypress);
        if (process.stdin.isTTY) process.stdin.setRawMode(false);
      }

      display.divider();
      if (!closed) {
        ask();
      }
    });
  };

  ask();
}

function createAgent(modelOption: ModelOption, display: Display): IAgent {
  const registry = new ToolRegistry()
    .register(new WriteFileTool())
    .register(new ReadFileTool())
    .register(new WebFetchTool())
    .register(new ScrapeWebsiteTool())
    .register(new ListFilesTool());

  if (modelOption.provider === 'gemini') {
    const apiKey = envValue(...modelOption.apiKeyNames);

    if (!apiKey) {
      throw new Error(`${modelOption.apiKeyNames[0]} is not set in .env.`);
    }

    const client = new GoogleGenAI({ apiKey });
    const history = new MessageHistory();
    const judge = new JudgeAgent(client);

    return new Agent(client, history, registry, judge, display, undefined, modelOption.model);
  }

  const apiKey = envValue(...modelOption.apiKeyNames);

  if (!apiKey) {
    throw new Error(`${modelOption.apiKeyNames[0]} is not set in .env.`);
  }

  const client = new Groq({ apiKey });
  const judge = new GroqJudgeAgent(client);

  return new GroqAgent(client, registry, judge, display, undefined, undefined, modelOption.model);
}

async function runWithModelRecovery(
  instruction: string,
  state: {
    getAgent(): IAgent;
    getCurrentModel(): ModelOption;
    setModel(model: ModelOption): void;
    display: Display;
  },
  signal: AbortSignal,
): Promise<void> {
  const failedModelIds = new Set<string>();

  // Keep retrying as long as there are available models that haven't failed yet
  for (;;) {
    try {
      await state.getAgent().run(instruction, signal);
      return;
    } catch (error) {
      if (!isApiFailure(error)) {
        throw error;
      }

      failedModelIds.add(state.getCurrentModel().id);

      const remaining = availableModelOptions().filter((m) => !failedModelIds.has(m.id));

      if (remaining.length === 0) {
        throw new Error(
          'All available models have hit quota or rate limits.\n  Add more API keys in .env or wait and try again.',
        );
      }

      const nextModel = await pickModel(
        availableModelOptions(),
        state.getCurrentModel().id,
        failedModelIds,
      );

      // If user pressed Escape and re-selected an already-failed model, inform and re-show picker
      if (failedModelIds.has(nextModel.id)) {
        state.display.warn(
          `${nextModel.label} already failed. Please pick a different model.`,
        );
        continue;
      }

      state.setModel(nextModel);
      state.display.switched(nextModel.label, nextModel.provider);
    }
  }
}

function availableModelOptions(): ModelOption[] {
  return MODEL_OPTIONS.filter((option) => envValue(...option.apiKeyNames));
}

function isApiFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  return [
    'api call failed',
    'api request',
    'rate_limit',
    'rate limit',
    'too many requests',
    'quota',
    'resource_exhausted',
    'exhausted',
    '429',
    '503',
    '500',
    'overloaded',
    'request too large',
    'tokens per minute',
    'tpm',
  ].some((signal) => message.includes(signal));
}

function envValue(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name];

    if (value) {
      return value;
    }
  }

  return undefined;
}

main().catch((error) => {
  console.error(`\n  Error: ${(error as Error).message}\n`);
  process.exit(1);
});
