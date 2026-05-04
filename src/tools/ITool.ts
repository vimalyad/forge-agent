import type { FunctionDeclaration } from '@google/genai';

export interface ITool {
  readonly name: string;
  readonly schema: FunctionDeclaration;
  execute(args: Record<string, unknown>): Promise<string>;
}
