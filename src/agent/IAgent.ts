export interface IAgent {
  run(userInput: string): Promise<void>;
}
