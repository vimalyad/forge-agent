export interface IAgent {
  run(userInput: string, signal?: AbortSignal): Promise<void>;
}
