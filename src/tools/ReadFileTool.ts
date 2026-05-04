import { Type, type FunctionDeclaration } from '@google/genai';
import fs from 'node:fs/promises';
import type { ITool } from '../core/ITool.js';
import { resolveWorkspacePath } from './PathGuard.js';

export class ReadFileTool implements ITool {
  readonly name = 'read_file';

  readonly schema: FunctionDeclaration = {
    name: this.name,
    description: 'Read a relative file path from the project workspace.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: {
          type: Type.STRING,
          description: 'Relative path to read.',
        },
      },
      required: ['path'],
    },
  };

  async execute(args: Record<string, unknown>): Promise<string> {
    const filePath = String(args.path ?? '');
    return fs.readFile(resolveWorkspacePath(filePath), 'utf8');
  }
}
