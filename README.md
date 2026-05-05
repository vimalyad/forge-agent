# forge-agent

`forge-agent` is a CLI website-cloning agent. It resolves a target site, scrapes the live page, generates `output/index.html`, validates the result, and opens the finished file in the default browser.

The runtime uses fixed model routing. Users do not choose models interactively.

## Current Model Flow

| Task | Provider | Model |
| --- | --- | --- |
| URL resolution | Groq | `llama-3.3-70b-versatile` |
| Draft HTML iterations | OpenRouter | `openrouter/free`, then `qwen/qwen3-coder:free`, then `deepseek/deepseek-r1:free` |
| Final HTML pass | Anthropic | `ANTHROPIC_CODE_MODEL` or `claude-sonnet-4-5-20250929` |
| Tool judge | Groq | `llama-3.3-70b-versatile` |
| Judge fallback | Cerebras | `llama-3.3-70b` |

With `MAX_AGENT_STEPS = 6`, draft attempts use OpenRouter when `OPENROUTER_API_KEY` is configured. The final generation step uses Anthropic. If an OpenRouter draft validates early, the agent still runs one final Anthropic pass before completion. OpenRouter draft generation uses a fallback list because free model availability changes over time.

## Features

- Natural-language target resolution through the predefined Groq route.
- Playwright scraping for semantic page structure, screenshots, and media assets.
- Cost-aware generation: free OpenRouter drafts, one Anthropic final pass.
- Tool judging through Groq with Cerebras fallback.
- Validation before completion through `OutputValidator`.
- Automatic preview of `output/index.html` in the OS default browser after success.
- Fixed model policy configured in code, not selected by users at runtime.
- Mid-run interruption with `Esc`, `Ctrl+C`, or `q`.

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
GROQ_API_KEY="your-groq-key"
OPENROUTER_API_KEY="your-openrouter-key"
CEREBRAS_API_KEY="your-cerebras-key"
```

`ANTHROPIC_CODE_MODEL` is optional. If omitted, the default in `src/config/constants.ts` is used.

## Usage

```bash
npm start
```

Example:

```text
Clone the Scaler Academy website and generate output/index.html with a header, hero section, and footer
```

Or without a URL:

```text
Recreate the OpenAI homepage
```

## Project Structure

- `src/index.ts` - CLI REPL, fixed agent creation, and abort handling.
- `src/providers/anthropic/AnthropicAgent.ts` - Main generation workflow coordinator.
- `src/providers/anthropic/HtmlGenerationPromptBuilder.ts` - HTML prompt, media asset, and blueprint compaction logic.
- `src/services/AnthropicMessagesClient.ts` - Anthropic Messages API client.
- `src/services/OpenRouterChatClient.ts` - OpenRouter draft-generation client.
- `src/services/OpenAICompatibleClient.ts` - Shared client for Groq, Cerebras, and other OpenAI-compatible routes.
- `src/services/OpenAICompatibleJudge.ts` - Tool judge implementation.
- `src/config/models.ts` - Task-to-model routes.
- `src/config/modelRuntime.ts` - Runtime constants such as token limits, output path, and draft model.
- `src/tools/` - File, web fetch, scrape, and workspace tools.
- `src/ui/Display.ts` - Terminal rendering.

## Build

```bash
npm run build
```
