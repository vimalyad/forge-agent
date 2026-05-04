import 'dotenv/config';
import readline from 'node:readline';
import { GoogleGenAI } from '@google/genai';
import { Agent } from './agent/Agent.js';
import { JudgeAgent } from './agent/JudgeAgent.js';
import { MessageHistory } from './agent/MessageHistory.js';
import { Display } from './ui/Display.js';
import { ListFilesTool } from './tools/ListFilesTool.js';
import { ReadFileTool } from './tools/ReadFileTool.js';
import { ToolRegistry } from './tools/ToolRegistry.js';
import { WebFetchTool } from './tools/WebFetchTool.js';
import { WriteFileTool } from './tools/WriteFileTool.js';

async function main(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error('Error: GEMINI_API_KEY is not set. Create a local .env file first.');
    process.exit(1);
  }

  const client = new GoogleGenAI({ apiKey });
  const display = new Display();
  const history = new MessageHistory();
  const registry = new ToolRegistry()
    .register(new WriteFileTool())
    .register(new ReadFileTool())
    .register(new WebFetchTool())
    .register(new ListFilesTool());
  const judge = new JudgeAgent(client);
  const agent = new Agent(client, history, registry, judge, display);

  display.banner();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  let closed = false;

  rl.on('close', () => {
    closed = true;
  });

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

void main();
