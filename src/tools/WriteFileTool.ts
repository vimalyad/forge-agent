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

    this.validateContent(filePath, content);

    await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
    await fs.writeFile(resolvedPath, content, 'utf8');

    return `Written ${content.length} bytes to ${filePath}`;
  }

  private validateContent(filePath: string, content: string): void {
    const normalizedContent = content.toLowerCase();
    const placeholders = [
      '<updated_html_content>',
      '<scrape_result>',
      '<html_content>',
      'todo',
      'content goes here',
      'placeholder',
    ];

    if (placeholders.some((placeholder) => normalizedContent.includes(placeholder))) {
      throw new Error('Refusing to write placeholder content. Provide the complete real file content.');
    }

    if (filePath.replace(/\\/g, '/') !== 'output/index.html') {
      return;
    }

    const requiredParts = ['<html', '<header', '<section', '<footer', '<style', '<script'];
    const missingParts = requiredParts.filter((part) => !normalizedContent.includes(part));

    if (missingParts.length > 0) {
      throw new Error(`output/index.html is incomplete. Missing: ${missingParts.join(', ')}`);
    }

    if (content.length < 1500) {
      throw new Error('output/index.html is too small to satisfy the clone requirements.');
    }
  }
}
