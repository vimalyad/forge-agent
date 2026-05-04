import type { FunctionDeclaration } from '@google/genai';
import type { ITool } from './ITool.js';

type JsonSchema = {
  type?: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
};

type GroqTool = {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: JsonSchema;
  };
};

export class ToolRegistry {
  private readonly tools = new Map<string, ITool>();

  register(tool: ITool): this {
    this.tools.set(tool.name, tool);
    return this;
  }

  schemas(): FunctionDeclaration[] {
    return Array.from(this.tools.values()).map((tool) => tool.schema);
  }

  groqTools(): GroqTool[] {
    return Array.from(this.tools.values()).map((tool) => ({
      type: 'function',
      function: {
        name: tool.schema.name ?? tool.name,
        description: tool.schema.description,
        parameters: this.toJsonSchema(tool.schema.parameters),
      },
    }));
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

  private toJsonSchema(schema: unknown): JsonSchema {
    if (!schema || typeof schema !== 'object') {
      return { type: 'object', properties: {} };
    }

    const source = schema as Record<string, unknown>;
    const result: JsonSchema = {};

    if (typeof source.type === 'string') {
      result.type = source.type.toLowerCase();
    }

    if (typeof source.description === 'string') {
      result.description = source.description;
    }

    if (Array.isArray(source.required)) {
      result.required = source.required.filter((value): value is string => typeof value === 'string');
    }

    if (source.items) {
      result.items = this.toJsonSchema(source.items);
    }

    if (source.properties && typeof source.properties === 'object') {
      const properties: Record<string, JsonSchema> = {};

      for (const [key, value] of Object.entries(source.properties)) {
        properties[key] = this.toJsonSchema(value);
      }

      result.properties = properties;
    }

    return result;
  }
}
