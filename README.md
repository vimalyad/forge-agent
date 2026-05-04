# forge-agent

A conversational CLI coding agent that uses Gemini or Groq to generate a Scaler Academy-style webpage in `output/index.html`.

## Setup

Use Node.js 20 or newer because the current `@google/genai` SDK requires it.

```bash
npm install
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

Choose a provider:

```text
1. Gemini
2. Groq
```

Then enter:

```text
Clone the Scaler Academy website and generate output/index.html with a header, hero section, and footer
```

The agent scrapes the live Scaler website into a compact semantic blueprint, loops through tool calls, writes real files, judges tool output, and returns to the CLI prompt when complete.

## Build

```bash
npm run build
```

## Project Structure

- `src/index.ts` wires the REPL and dependencies.
- `src/agent/Agent.ts` runs the Gemini reasoning and tool execution loop.
- `src/agent/GroqAgent.ts` runs the Groq reasoning and tool execution loop.
- `src/agent/JudgeAgent.ts` and `src/agent/GroqJudgeAgent.ts` evaluate important tool outputs.
- `src/tools/` contains file, listing, web fetch, and semantic scrape tools.
- `src/ui/Display.ts` owns terminal output.
