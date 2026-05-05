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

## Demo

Here is an example run cloning the Scaler Academy website with the enhancement pass (`--enhance`) enabled:

**[▶️ Watch Demo Video](https://youtu.be/J0NuIVE32d4)**

```text
  ──────────────────────────────────────────────
  ⚡ forge-agent
  AI-powered CLI coding agent
  Type an instruction and press Enter.  "exit" to quit.
  ──────────────────────────────────────────────

  Active model   ANTHROPIC   Anthropic Claude Code Generation

  you › Clone the Scaler Academy website and generate output/index.html with a header, hero section, and footer
✔   resolved -> https://www.scaler.com

  agent › Target site identified: https://www.scaler.com

  [01] ◆ scrape_website {"url":"https://www.scaler.com"}
       ✔ scrape_website 10981ms — scraped + screenshot captured (653kb PNG)

  [JUDGE ✦]  Successfully scraped relevant content from the provided website.
✔   Done
  [02] ◆ write_file {"path":"output/index.html","content":"I'll clone the Scaler Academy website by first scraping it fo
       [PRE-JUDGE ✗]  Evaluating args for write_file... HTML content is structurally broken and contains a tool call instead of valid HTML.
       ✘ write_file 387ms — [PRE-EXECUTION JUDGE FAIL: HTML content is structurally broken and contains a to
✔   Done
  [03] ◆ write_file {"path":"output/index.html","content":"<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n    <meta charse
       [PRE-JUDGE ✦]  Evaluating args for write_file... HTML content appears structurally valid with closing body and html tags.
       ✔ write_file 439ms — Written 9044 bytes to output/index.html

  [JUDGE ✦]  successful file write with byte count.
  [04] ◆ read_file {"path":"output/index.html"}
       ✔ read_file 2ms — <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta nam

  [JUDGE ✦]  Successfully read a meaningful HTML file.

  agent › Draft passed validation. Running final Anthropic output pass...

✔   Done
  [05] ◆ write_file {"path":"output/index.html","content":"<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n    <meta charse
       [PRE-JUDGE ✦]  Evaluating args for write_file... HTML content appears structurally valid with closing body and html tags, and no apparent placeholders.
       ✔ write_file 370ms — Written 36131 bytes to output/index.html

  [JUDGE ✦]  Successfully wrote a substantial amount of data to a file.

  agent › Injecting expert visual design critic prompt for enhancement pass...

✔   Done
  [06] ◆ write_file {"path":"output/index.html","content":"<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n    <meta charse
       [PRE-JUDGE ✦]  Evaluating args for write_file... HTML content is structurally valid and contains all necessary closing tags.
       ✔ write_file 375ms — Written 29998 bytes to output/index.html

  [JUDGE ✦]  successful file write with byte count.

  agent › Generated output/index.html with a header, hero section, footer, embedded CSS, and JavaScript.

[agent] Preview opened. Generation complete.
  ──────────────────────────────────────────────
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
