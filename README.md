# ⚡ forge-agent

A conversational, autonomous CLI coding agent that uses **Gemini** or **Groq** to intelligently clone and recreate websites directly from your terminal. 

Built to demonstrate advanced Agentic AI workflows, `forge-agent` doesn't just write code — it plans, scrapes, visually analyzes, evaluates its own output, and handles errors gracefully.

## ✨ Features

- **🧠 Smart Target Resolution:** Ask to "Clone the ChatGPT website" in natural language. If no explicit URL is provided, the agent uses a fast, zero-temperature LLM call to resolve the brand to its canonical URL.
- **👁️ Vision-Augmented Scraping:** Uses Playwright to extract a clean semantic blueprint of the target *and* captures a live screenshot. The screenshot is fed into vision-capable models (Gemini 2.5 Flash, Groq Llama 4 Scout) so the agent can perfectly match colors, layouts, and typography.
- **🔄 Multi-Step Agentic Loop:** The agent plans its approach, writes to the filesystem, reads its output back to verify, and iterates up to 12 times to fix bugs before claiming completion.
- **⚖️ Self-Evaluating Judges:** Key tool outputs are evaluated by a secondary "Judge" LLM to ensure quality and correctness during the loop.
- **🛡️ Quota Fallback & Model Picker:** Exhausted your free tier? The agent catches rate-limits (429s) and instantly pauses to present an interactive keyboard UI to switch models mid-flight and seamlessly retry.
- **🛑 Mid-Run Interruption:** Long generation or scraping taking too long? Press `Esc`, `Ctrl+C`, or `q` at any time to abort the current loop and drop cleanly back to the prompt, just like Codex or Cursor.
- **💅 Beautiful CLI UI:** Clean typography, progress tracking, millisecond timing, and visual provider badges make the terminal experience feel premium.

## 🚀 Setup

Requires Node.js 20+ (required by the `@google/genai` SDK).

```bash
npm install
# Install Playwright dependencies for visual scraping
npx playwright install chromium
```

Create a local `.env` file with your API keys:

```env
GEMINI_API_KEY="your-gemini-key"
GROQ_API_KEY="your-groq-key"
```

## 💻 Usage

```bash
npm start
```

The CLI starts with **Gemini 2.5 Flash** by default. Type an instruction like:

> *Clone the Scaler Academy website and generate output/index.html with a header, hero section, and footer*

Or, try a natural language instruction without a URL:

> *Recreate the OpenAI homepage*

## 🏗️ Project Structure

- `src/index.ts` — Main REPL loop, UI state, and AbortController wiring.
- `src/agent/Agent.ts` — Native Gemini implementation of the reasoning loop.
- `src/agent/GroqAgent.ts` — Groq/Llama implementation, with custom `image_url` vision injection.
- `src/tools/` — Contains file manipulation, web fetching, and the rich `ScrapeWebsiteTool` (Playwright HTML parsing + Screenshot).
- `src/agent/JudgeAgent.ts` — The evaluation system for validating tool output.
- `src/ui/` — Code for the terminal Display and interactive Model Picker.

## 🛠️ Build

To compile TypeScript without running:

```bash
npm run build
```
