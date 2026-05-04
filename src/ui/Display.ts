import chalk from 'chalk';
import ora, { type Ora } from 'ora';

export class Display {
  private spinner: Ora | null = null;

  banner(): void {
    console.log('');
    console.log(chalk.bold.cyan('  forge-agent'));
    console.log(chalk.gray('  AI-powered CLI coding agent'));
    console.log(chalk.gray('  Type an instruction and press Enter. Type "exit" to quit.\n'));
  }

  prompt(): string {
    return chalk.cyan('  you > ');
  }

  agentMessage(text: string): void {
    console.log('');
    console.log(chalk.bold.green('  agent > ') + chalk.white(text));
    console.log('');
  }

  toolCall(toolName: string, args: Record<string, unknown>): void {
    const preview = JSON.stringify(args).slice(0, 120);
    console.log(chalk.yellow(`  tool ${toolName}`) + chalk.gray(` ${preview}`));
  }

  toolResult(toolName: string, success: boolean, detail?: string): void {
    const label = success ? chalk.green('ok') : chalk.red('fail');
    const extra = detail ? chalk.gray(` - ${detail}`) : '';
    console.log(`  ${label} ${chalk.bold(toolName)}${extra}`);
  }

  judgeResult(passed: boolean, reason: string): void {
    const label = passed ? chalk.bold.green('[JUDGE PASS]') : chalk.bold.red('[JUDGE FAIL]');
    console.log(`  ${label} ${chalk.gray(reason)}`);
  }

  startSpinner(text: string): void {
    this.spinner = ora({ text: chalk.gray(`  ${text}`), color: 'cyan' }).start();
  }

  stopSpinner(success = true, text?: string): void {
    if (!this.spinner) {
      return;
    }

    if (success) {
      this.spinner.succeed(chalk.gray(`  ${text ?? 'Done'}`));
    } else {
      this.spinner.fail(chalk.red(`  ${text ?? 'Failed'}`));
    }

    this.spinner = null;
  }

  error(message: string): void {
    console.error(chalk.red(`\n  Error: ${message}\n`));
  }

  divider(): void {
    console.log(chalk.gray('  ----------------------------------------'));
  }
}
