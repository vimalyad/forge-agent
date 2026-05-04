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
import { Display } from './ui/Display.js';
import { ListFilesTool } from './tools/ListFilesTool.js';
import { ReadFileTool } from './tools/ReadFileTool.js';
import { ScrapeWebsiteTool } from './tools/ScrapeWebsiteTool.js';
import { ToolRegistry } from './tools/ToolRegistry.js';
import { WebFetchTool } from './tools/WebFetchTool.js';
import { WriteFileTool } from './tools/WriteFileTool.js';

type Provider = 'gemini' | 'groq';

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

  const provider = await chooseProvider(rl);
  const agent = createAgent(provider, display);

  console.log(`\n  Using ${provider}.\n`);

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
        await agent.run(instruction);
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

function createAgent(provider: Provider, display: Display): IAgent {
  const registry = new ToolRegistry()
    .register(new WriteFileTool())
    .register(new ReadFileTool())
    .register(new WebFetchTool())
    .register(new ScrapeWebsiteTool())
    .register(new ListFilesTool());

  if (provider === 'gemini') {
    const apiKey = envValue('GEMINI_API_KEY', 'gemini_api_key');

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set in .env.');
    }

    const client = new GoogleGenAI({ apiKey });
    const history = new MessageHistory();
    const judge = new JudgeAgent(client);

    return new Agent(client, history, registry, judge, display);
  }

  const apiKey = envValue('GROQ_API_KEY', 'groq_api_key');

  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not set in .env.');
  }

  const client = new Groq({ apiKey });
  const judge = new GroqJudgeAgent(client);

  return new GroqAgent(client, registry, judge, display);
}

async function chooseProvider(rl: readline.Interface): Promise<Provider> {
  while (true) {
    const answer = await question(rl, '  Choose model provider:\n  1. Gemini\n  2. Groq\n  provider > ');
    const normalized = answer.trim().toLowerCase();

    if (normalized === '1' || normalized === 'gemini') {
      return 'gemini';
    }

    if (normalized === '2' || normalized === 'groq') {
      return 'groq';
    }

    console.log('\n  Please choose 1 for Gemini or 2 for Groq.\n');
  }
}

function question(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
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
