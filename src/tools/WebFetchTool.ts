import { Type, type FunctionDeclaration } from '@google/genai';
import type { ITool } from './ITool.js';

export class WebFetchTool implements ITool {
  readonly name = 'web_fetch';

  readonly schema: FunctionDeclaration = {
    name: this.name,
    description: 'Fetch text content from an HTTP or HTTPS URL.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        url: {
          type: Type.STRING,
          description: 'URL to fetch.',
        },
      },
      required: ['url'],
    },
  };

  async execute(args: Record<string, unknown>): Promise<string> {
    const url = String(args.url ?? '');
    const parsedUrl = new URL(url);

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Only HTTP and HTTPS URLs are supported.');
    }

    const response = await fetch(parsedUrl, {
      headers: {
        'User-Agent': 'forge-agent/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`Fetch failed with status ${response.status}`);
    }

    const text = await response.text();
    return text.slice(0, 12000);
  }
}
