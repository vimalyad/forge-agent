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

  console.log(`  Using ${currentModel.label} by default.\n`);

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

      try {
        await runWithModelRecovery(instruction, {
          getAgent: () => agent,
          getCurrentModel: () => currentModel,
          setModel: (nextModel) => {
            currentModel = nextModel;
            agent = createAgent(currentModel, display);
          },
        });
      } catch (error) {
        display.error((error as Error).message);
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
  },
): Promise<void> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await state.getAgent().run(instruction);
      return;
    } catch (error) {
      lastError = error;

      if (!isApiFailure(error) || attempt > 0) {
        throw error;
      }

      const nextModel = await pickModel(availableModelOptions(), state.getCurrentModel().id);
      state.setModel(nextModel);
      console.log(`  Switched to ${nextModel.label}. Retrying...\n`);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
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
