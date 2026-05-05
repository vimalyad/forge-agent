import "dotenv/config";
import readline from "node:readline";
import { AnthropicAgent } from "./providers/anthropic/AnthropicAgent.js";
import type { IAgent } from "./core/IAgent.js";
import {
  DEFAULT_MODEL_OPTION,
  type ModelOption,
} from "./config/models.js";
import { Display } from "./ui/Display.js";
import { ListFilesTool } from "./tools/ListFilesTool.js";
import { ReadFileTool } from "./tools/ReadFileTool.js";
import { ScrapeWebsiteTool } from "./tools/ScrapeWebsiteTool.js";
import { ToolRegistry } from "./tools/ToolRegistry.js";
import { WebFetchTool } from "./tools/WebFetchTool.js";
import { WriteFileTool } from "./tools/WriteFileTool.js";
import { TaskRouter } from "./services/TaskRouter.js";
import { OpenAICompatibleJudge } from "./services/OpenAICompatibleJudge.js";
import type { ToolJudge } from "./core/ToolJudge.js";

async function main(): Promise<void> {
  const display = new Display();

  display.banner();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  let closed = false;

  rl.on("close", () => {
    closed = true;
  });

  const currentModel = DEFAULT_MODEL_OPTION;
  const router = new TaskRouter();
  const agent = createAgent(currentModel, display, router);

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

      if (instruction.toLowerCase() === "exit") {
        console.log("\n  Goodbye.\n");
        rl.close();
        return;
      }

      const ac = new AbortController();

      // Listen for ESC (0x1b), Ctrl+C (0x03), or 'q' to abort
      const onKeypress = (chunk: Buffer) => {
        const key = chunk.toString();
        if (key === "\x1b" || key === "\x03" || key.toLowerCase() === "q") {
          ac.abort();
        }
      };

      process.stdin.on("data", onKeypress);
      if (process.stdin.isTTY) process.stdin.setRawMode(true);

      const options = {
        enhance: process.argv.includes("--enhance"),
        dryRun: process.argv.includes("--dry-run"),
      };

      try {
        await agent.run(instruction, ac.signal, options);
      } catch (error) {
        if ((error as { name?: string }).name === "AbortError") {
          display.interrupted();
        } else {
          display.error((error as Error).message);
        }
      } finally {
        process.stdin.off("data", onKeypress);
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

function createJudge(router: TaskRouter, display: Display): ToolJudge {
  return new OpenAICompatibleJudge(router, display);
}

function createAgent(
  modelOption: ModelOption,
  display: Display,
  router: TaskRouter,
): IAgent {
  const registry = new ToolRegistry()
    .register(new WriteFileTool())
    .register(new ReadFileTool())
    .register(new WebFetchTool())
    .register(new ScrapeWebsiteTool())
    .register(new ListFilesTool());

  const judge = createJudge(router, display);

  const apiKey = envValue(...modelOption.apiKeyNames);

  if (!apiKey) {
    throw new Error(`${modelOption.apiKeyNames[0]} is not set in .env.`);
  }

  return new AnthropicAgent(
    apiKey,
    registry,
    judge,
    display,
    undefined,
    undefined,
    modelOption.model,
    router,
  );
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
