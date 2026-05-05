# forge-agent

A conversational, autonomous CLI coding agent that uses predefined model routes to clone and recreate websites from the terminal. Code generation and vision-backed page reconstruction now run through Anthropic.

The agent plans, scrapes, visually analyzes, evaluates tool output, writes `output/index.html`, reads it back, and iterates until the generated page passes validation.

## Features

- **Smart target resolution:** Natural-language requests such as "Clone the ChatGPT website" are resolved to a canonical homepage URL by the predefined fast Anthropic route.
- **Vision-augmented scraping:** Playwright extracts a semantic blueprint and captures a live screenshot. The screenshot is sent to Anthropic for visual layout, color, spacing, and typography matching.
- **Multi-step generation loop:** The agent writes the page, reads it back, validates it, and retries with corrections.
- **Self-evaluating judges:** Tool outputs can be judged by the predefined judge route. The current default uses Groq with a Cerebras fallback when configured.
- **Fixed model policy:** Users do not choose models at runtime. Model-to-task mapping lives in `src/config/models.ts`.
- **Mid-run interruption:** Press `Esc`, `Ctrl+C`, or `q` to abort the current loop and return to the prompt.

## Setup

Requires Node.js 20+.

```bash
npm install
npx playwright install chromium
```

Create a local `.env` file:

```env
ANTHROPIC_API_KEY="your-anthropic-key"
ANTHROPIC_CODE_MODEL="claude-sonnet-4-5-20250929"
ANTHROPIC_FAST_MODEL="claude-3-5-haiku-20241022"
GROQ_API_KEY="your-groq-key"
CEREBRAS_API_KEY="your-cerebras-key"
```

`ANTHROPIC_CODE_MODEL` and `ANTHROPIC_FAST_MODEL` are optional. If omitted, the defaults in `src/config/constants.ts` are used.

## Usage

```bash
npm start
```

Example:

> Clone the Scaler Academy website and generate output/index.html with a header, hero section, and footer

Or without a URL:

> Recreate the OpenAI homepage

## Project Structure

- `src/index.ts` - Main REPL loop, fixed agent creation, UI state, and abort handling.
- `src/providers/anthropic/AnthropicAgent.ts` - Anthropic implementation of the generation loop.
- `src/config/models.ts` - Predefined model routes by task.
- `src/services/OpenAICompatibleJudge.ts` - Judge route implementation for Groq/Cerebras/OpenRouter-compatible APIs.
- `src/tools/` - File manipulation, web fetching, and rich website scraping.
- `src/ui/Display.ts` - Terminal rendering and provider status display.

## Build

```bash
npm run build
```
