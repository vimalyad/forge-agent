import type { FunctionDeclaration } from '@google/genai';
import type { ITool } from './ITool.js';

export class ToolRegistry {
  private readonly tools = new Map<string, ITool>();

  register(tool: ITool): this {
    this.tools.set(tool.name, tool);
    return this;
  }

  schemas(): FunctionDeclaration[] {
    return Array.from(this.tools.values()).map((tool) => tool.schema);
  }

  async execute(name: string | undefined, args: Record<string, unknown> | undefined): Promise<string> {
    if (!name) {
      throw new Error('Tool call did not include a name.');
    }

    const tool = this.tools.get(name);

    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }

    return tool.execute(args ?? {});
  }
}
