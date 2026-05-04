import chalk, { type ChalkInstance } from 'chalk';
import ora, { type Ora } from 'ora';
import type { ModelProvider } from '../config/models.js';

// ─── provider badge colours ──────────────────────────────────────────────────
const PROVIDER_COLOR: Record<ModelProvider, ChalkInstance> = {
  gemini: chalk.bgHex('#4285F4').black,
  groq:   chalk.bgHex('#F55036').white,
};

function providerBadge(provider: ModelProvider): string {
  return PROVIDER_COLOR[provider](` ${provider.toUpperCase()} `);
}

// ─── Display ─────────────────────────────────────────────────────────────────
export class Display {
  private spinner: Ora | null = null;
  private stepCount  = 0;
  private stepStart  = 0;

  // ── banner ────────────────────────────────────────────────────────────────
  banner(): void {
    const line   = chalk.hex('#3B82F6')('─'.repeat(46));
    const title  = chalk.bold.hex('#60A5FA')('⚡ forge-agent');
    const sub    = chalk.hex('#94A3B8')('AI-powered CLI coding agent');
    const hint   = chalk.hex('#64748B')('Type an instruction and press Enter.  "exit" to quit.');

    console.log('');
    console.log(`  ${line}`);
    console.log(`  ${title}`);
    console.log(`  ${sub}`);
    console.log(`  ${hint}`);
    console.log(`  ${line}`);
    console.log('');
  }

  // ── model status line (startup) ───────────────────────────────────────────
  modelStatus(label: string, provider: ModelProvider): void {
    console.log(
      `  ${chalk.hex('#94A3B8')('Active model')}  ${providerBadge(provider)}  ${chalk.bold.white(label)}\n`,
    );
  }

  // ── model switched ────────────────────────────────────────────────────────
  switched(label: string, provider: ModelProvider): void {
    console.log(
      `\n  ${chalk.hex('#22D3EE')('↺')}  Switched to ${providerBadge(provider)}  ${chalk.bold.white(label)}  — retrying…\n`,
    );
  }

  // ── prompt ────────────────────────────────────────────────────────────────
  prompt(): string {
    return chalk.hex('#60A5FA').bold('  you › ');
  }

  // ── agent message ─────────────────────────────────────────────────────────
  agentMessage(text: string): void {
    console.log('');
    console.log(chalk.bold.hex('#34D399')('  agent › ') + chalk.white(text));
    console.log('');
  }

  // ── tool call ─────────────────────────────────────────────────────────────
  toolCall(toolName: string, args: Record<string, unknown>): void {
    this.stepCount += 1;
    this.stepStart  = Date.now();
    const preview   = JSON.stringify(args).slice(0, 100);

    console.log(
      `  ${chalk.hex('#94A3B8')(`[${String(this.stepCount).padStart(2, '0')}]`)} ` +
      `${chalk.hex('#FBBF24').bold('◆')} ` +
      `${chalk.hex('#FBBF24').bold(toolName)} ` +
      chalk.hex('#64748B')(preview),
    );
  }

  // ── tool result ───────────────────────────────────────────────────────────
  toolResult(toolName: string, success: boolean, detail?: string): void {
    const ms    = Date.now() - this.stepStart;
    const icon  = success ? chalk.hex('#34D399')('✔') : chalk.hex('#F87171')('✘');
    const name  = success ? chalk.hex('#34D399').bold(toolName) : chalk.hex('#F87171').bold(toolName);
    const time  = chalk.hex('#475569')(`${ms}ms`);
    const extra = detail ? chalk.hex('#64748B')(` — ${detail.slice(0, 80)}`) : '';

    console.log(`       ${icon} ${name} ${time}${extra}`);
  }

  // ── judge result ──────────────────────────────────────────────────────────
  judgeResult(passed: boolean, reason: string): void {
    const icon  = passed ? '✦' : '✗';
    const color = passed ? chalk.hex('#34D399') : chalk.hex('#F87171');
    console.log(`\n  ${color.bold(`[JUDGE ${icon}]`)}  ${chalk.hex('#94A3B8')(reason)}`);
  }

  // ── spinner ───────────────────────────────────────────────────────────────
  startSpinner(text: string): void {
    this.spinner = ora({
      text:    chalk.hex('#94A3B8')(`  ${text}`),
      color:   'cyan',
      spinner: 'dots',
    }).start();
  }

  stopSpinner(success = true, text?: string): void {
    if (!this.spinner) return;

    if (success) {
      this.spinner.succeed(chalk.hex('#94A3B8')(`  ${text ?? 'Done'}`));
    } else {
      this.spinner.fail(chalk.hex('#F87171')(`  ${text ?? 'Failed'}`));
    }

    this.spinner = null;
  }

  // ── interrupted ───────────────────────────────────────────────────────────
  interrupted(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }

    console.log(
      `\n  ${chalk.hex('#FBBF24').bold('◼  Interrupted')}  ` +
      chalk.hex('#64748B')('(press Enter to continue)') +
      '\n',
    );
  }

  // ── warn ──────────────────────────────────────────────────────────────────
  warn(message: string): void {
    console.log(`\n  ${chalk.hex('#FBBF24')('⚠')}  ${chalk.hex('#FBBF24')(message)}\n`);
  }

  // ── error ─────────────────────────────────────────────────────────────────
  error(message: string): void {
    console.error(`\n  ${chalk.hex('#F87171').bold('✘  Error:')} ${chalk.hex('#FCA5A5')(message)}\n`);
  }

  // ── divider ───────────────────────────────────────────────────────────────
  divider(): void {
    this.stepCount = 0;
    console.log(chalk.hex('#1E293B')('  ' + '─'.repeat(46)));
  }
}
