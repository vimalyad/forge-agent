export interface AgentOptions {
  enhance?: boolean;
  dryRun?: boolean;
}

export interface IAgent {
  run(
    userInput: string,
    signal?: AbortSignal,
    options?: AgentOptions,
  ): Promise<void>;
}
