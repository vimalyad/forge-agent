import { Type, type FunctionDeclaration } from '@google/genai';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ITool } from './ITool.js';
import { resolveWorkspacePath } from './PathGuard.js';

export class WriteFileTool implements ITool {
  readonly name = 'write_file';

  readonly schema: FunctionDeclaration = {
    name: this.name,
    description: 'Write content to a relative file path. Creates directories when needed.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: {
          type: Type.STRING,
          description: 'Relative path to write, for example output/index.html.',
        },
        content: {
          type: Type.STRING,
          description: 'Full file content to write.',
        },
      },
      required: ['path', 'content'],
    },
  };

  async execute(args: Record<string, unknown>): Promise<string> {
    const filePath = String(args.path ?? '');
    const content = String(args.content ?? '');
    const resolvedPath = resolveWorkspacePath(filePath);

    await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
    await fs.writeFile(resolvedPath, content, 'utf8');

    return `Written ${content.length} bytes to ${filePath}`;
  }
}
