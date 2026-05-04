import chalk, { type ChalkInstance } from "chalk";
import readline from "node:readline";
import type { ModelOption, ModelProvider } from "../config/models.js";

// ─── provider badge colours ───────────────────────────────────────────────────
const PROVIDER_COLOR: Record<ModelProvider, ChalkInstance> = {
  gemini: chalk.bgHex("#4285F4").black,
  groq: chalk.bgHex("#F55036").white,
};

function providerBadge(provider: ModelProvider): string {
  return PROVIDER_COLOR[provider](` ${provider.toUpperCase()} `);
}

// ─── pickModel ────────────────────────────────────────────────────────────────
export async function pickModel(
  options: ModelOption[],
  currentModelId: string,
  failedModelIds: ReadonlySet<string> = new Set(),
): Promise<ModelOption> {
  if (options.length === 0) {
    throw new Error("No configured model has an API key available.");
  }

  // Default cursor: first non-failed model, or first overall
  const firstGood = options.findIndex((o) => !failedModelIds.has(o.id));
  let selectedIndex = firstGood >= 0 ? firstGood : 0;

  readline.emitKeypressEvents(process.stdin);
  const wasRaw = process.stdin.isRaw;

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  process.stdin.resume();

  return new Promise((resolve) => {
    let renderedLines = 0;

    const render = (): void => {
      // Move cursor back to start of rendered block
      if (renderedLines > 0) {
        process.stdout.write(`\x1B[${renderedLines}F`);
      }

      process.stdout.write("\x1B[0J"); // clear to end of screen

      // ── header ────────────────────────────────────────────────────────────
      process.stdout.write(
        `  ${chalk.hex("#F87171").bold("⚠  API call failed.")}  ` +
          `${chalk.hex("#94A3B8")("Pick a model  ")}` +
          `${chalk.hex("#64748B")("↑↓ navigate   ↵ confirm   Esc cancel")}\n`,
      );

      // ── model list ────────────────────────────────────────────────────────
      for (let i = 0; i < options.length; i += 1) {
        const opt = options[i];
        const active = i === selectedIndex;
        const failed = failedModelIds.has(opt.id);
        const isCurrent = opt.id === currentModelId;

        const cursor = active ? chalk.hex("#60A5FA").bold("  › ") : "    ";
        const label = failed
          ? chalk.hex("#64748B").strikethrough(opt.label)
          : active
            ? chalk.bold.white(opt.label)
            : chalk.hex("#CBD5E1")(opt.label);

        const badge = providerBadge(opt.provider);
        const tags: string[] = [];
        if (isCurrent) tags.push(chalk.hex("#64748B")("current"));
        if (failed) tags.push(chalk.hex("#F87171")("quota exceeded"));
        const suffix = tags.length > 0 ? "  " + tags.join("  ") : "";

        process.stdout.write(`${cursor}${badge}  ${label}${suffix}\n`);
      }

      renderedLines = options.length + 1;
    };

    const cleanup = (): void => {
      process.stdin.off("keypress", onKeypress);

      if (process.stdin.isTTY) {
        process.stdin.setRawMode(wasRaw);
      }
    };

    const onKeypress = (_value: string, key: readline.Key): void => {
      if (key.name === "up") {
        selectedIndex =
          selectedIndex === 0 ? options.length - 1 : selectedIndex - 1;
        render();
        return;
      }

      if (key.name === "down") {
        selectedIndex =
          selectedIndex === options.length - 1 ? 0 : selectedIndex + 1;
        render();
        return;
      }

      if (key.name === "return") {
        cleanup();
        resolve(options[selectedIndex]);
        return;
      }

      if (key.name === "escape" || (key.ctrl && key.name === "c")) {
        cleanup();
        // Return current selection (caller handles the "already failed" case)
        resolve(options[selectedIndex]);
      }
    };

    process.stdin.on("keypress", onKeypress);
    render();
  });
}
