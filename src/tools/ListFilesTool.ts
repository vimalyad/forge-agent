import { Type, type FunctionDeclaration } from '@google/genai';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ITool } from '../core/ITool.js';
import { resolveWorkspacePath } from './PathGuard.js';

export class ListFilesTool implements ITool {
  readonly name = 'list_files';

  readonly schema: FunctionDeclaration = {
    name: this.name,
    description: 'List files below a relative directory in the project workspace.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        directory: {
          type: Type.STRING,
          description: 'Relative directory to list. Defaults to output.',
        },
      },
    },
  };

  async execute(args: Record<string, unknown>): Promise<string> {
    const directory = String(args.directory ?? 'output');
    const root = resolveWorkspacePath(directory);
    const files = await this.walk(root);

    return files.map((file) => path.relative(process.cwd(), file)).join('\n') || '(empty)';
  }

  private async walk(directory: string): Promise<string[]> {
    const results: string[] = [];

    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
          results.push(...await this.walk(fullPath));
        } else {
          results.push(fullPath);
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    return results;
  }
}
