import chalk from 'chalk';
import readline from 'node:readline';
import type { ModelOption } from '../config/models.js';

export async function pickModel(options: ModelOption[], currentModelId: string): Promise<ModelOption> {
  if (options.length === 0) {
    throw new Error('No configured model has an API key available.');
  }

  const currentIndex = Math.max(0, options.findIndex((option) => option.id === currentModelId));
  let selectedIndex = currentIndex;

  readline.emitKeypressEvents(process.stdin);

  const wasRaw = process.stdin.isRaw;

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  process.stdin.resume();

  return new Promise((resolve) => {
    let renderedLines = 0;

    const render = (): void => {
      if (renderedLines > 0) {
        process.stdout.write(`\x1B[${renderedLines}F`);
      }

      process.stdout.write('\x1B[0J');
      process.stdout.write(chalk.yellow('  API request failed. Choose another model with arrow keys, then press Enter.\n'));

      for (let index = 0; index < options.length; index += 1) {
        const option = options[index];
        const marker = index === selectedIndex ? chalk.cyan('  > ') : '    ';
        const current = option.id === currentModelId ? chalk.gray(' current') : '';
        process.stdout.write(`${marker}${option.label}${chalk.gray(` (${option.provider})`)}${current}\n`);
      }

      renderedLines = options.length + 1;
    };

    const cleanup = (): void => {
      process.stdin.off('keypress', onKeypress);

      if (process.stdin.isTTY) {
        process.stdin.setRawMode(wasRaw);
      }
    };

    const onKeypress = (_value: string, key: readline.Key): void => {
      if (key.name === 'up') {
        selectedIndex = selectedIndex === 0 ? options.length - 1 : selectedIndex - 1;
        render();
        return;
      }

      if (key.name === 'down') {
        selectedIndex = selectedIndex === options.length - 1 ? 0 : selectedIndex + 1;
        render();
        return;
      }

      if (key.name === 'return') {
        cleanup();
        resolve(options[selectedIndex]);
        return;
      }

      if (key.name === 'escape' || (key.ctrl && key.name === 'c')) {
        cleanup();
        resolve(options[currentIndex]);
      }
    };

    process.stdin.on('keypress', onKeypress);
    render();
  });
}
