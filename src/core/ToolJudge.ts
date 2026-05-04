export interface ToolJudge {
  evaluatePre(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<{ passed: boolean; reason: string }>;
  evaluate(
    toolName: string,
    toolOutput: string,
  ): Promise<{ passed: boolean; reason: string }>;
}
