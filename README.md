# forge-agent

A conversational CLI coding agent that uses the Gemini API to generate a Scaler Academy-style webpage in `output/index.html`.

## Setup

Use Node.js 20 or newer because the current `@google/genai` SDK requires it.

```bash
npm install
```

Create a local `.env` file with:

```env
GEMINI_API_KEY="your-key"
```

## Run

```bash
npm start
```

Then enter:

```text
Clone the Scaler Academy website and generate output/index.html with a header, hero section, and footer
```

The agent fetches the live Scaler website, loops through tool calls, writes real files, judges tool output, and returns to the CLI prompt when complete.

## Build

```bash
npm run build
```

## Project Structure

- `src/index.ts` wires the REPL and dependencies.
- `src/agent/Agent.ts` runs the reasoning and tool execution loop.
- `src/agent/JudgeAgent.ts` evaluates important tool outputs.
- `src/tools/` contains file, listing, and web fetch tools.
- `src/ui/Display.ts` owns terminal output.
