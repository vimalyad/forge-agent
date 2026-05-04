import type { GoogleGenAI } from '@google/genai';
import { JUDGE_MODEL } from '../config/constants.js';

const JUDGE_PROMPT = `You are a strict CLI-agent judge.
Given a tool name and its output, respond with exactly one line:
PASS: <brief reason>
or
FAIL: <brief reason>
Pass useful file writes, successful web fetches, and meaningful file reads. Fail empty, irrelevant, or error output.`;

export class JudgeAgent {
  constructor(private readonly client: GoogleGenAI) {}

  async evaluate(toolName: string, toolOutput: string): Promise<{ passed: boolean; reason: string }> {
    const response = await this.client.models.generateContent({
      model: JUDGE_MODEL,
      contents: `Tool: ${toolName}\nOutput:\n${toolOutput.slice(0, 3000)}`,
      config: {
        systemInstruction: JUDGE_PROMPT,
      },
    });

    const text = (response.text ?? '').trim();
    const passed = text.toUpperCase().startsWith('PASS');
    const reason = text.replace(/^(PASS|FAIL):\s*/i, '') || 'No judge reason returned.';

    return { passed, reason };
  }
}
