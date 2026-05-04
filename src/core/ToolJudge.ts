export interface ToolJudge {
  evaluate(toolName: string, toolOutput: string): Promise<{ passed: boolean; reason: string }>;
}
