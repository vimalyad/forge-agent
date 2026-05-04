# forge-agent

A conversational CLI coding agent that uses Gemini or Groq to generate a Scaler Academy-style webpage in `output/index.html`.

## Setup

Use Node.js 20 or newer because the current `@google/genai` SDK requires it.

```bash
npm install
npx playwright install chromium
```

Create a local `.env` file with:

```env
GEMINI_API_KEY="your-key"
GROQ_API_KEY="your-key"
```

## Run

```bash
npm start
```

The CLI starts with Gemini 2.5 Flash by default. Enter:

```text
Clone the Scaler Academy website and generate output/index.html with a header, hero section, and footer
```

The agent scrapes the live Scaler website into a compact semantic blueprint, loops through tool calls, writes real files, judges tool output, and returns to the CLI prompt when complete. If an API request fails, the CLI opens an arrow-key model picker so you can switch models and retry without restarting.

If Playwright Chromium is installed, the scraper renders the page before extracting the semantic tree; otherwise it falls back to plain fetch and prints the fallback reason.

## Build

```bash
npm run build
```

## Project Structure

- `src/index.ts` wires the REPL and dependencies.
- `src/agent/Agent.ts` runs the Gemini reasoning and tool execution loop.
- `src/agent/GroqAgent.ts` runs the Groq reasoning and tool execution loop.
- `src/agent/ScalerPageFactory.ts` provides a polished fallback page when Groq repeatedly returns incomplete HTML.
- `src/agent/JudgeAgent.ts` and `src/agent/GroqJudgeAgent.ts` evaluate important tool outputs.
- `src/tools/` contains file, listing, web fetch, and semantic scrape tools.
- `src/ui/Display.ts` owns terminal output.
