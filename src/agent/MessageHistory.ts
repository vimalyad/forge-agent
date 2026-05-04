import type { Content } from '@google/genai';

export class MessageHistory {
  private messages: Content[] = [];

  push(message: Content): void {
    this.messages.push(message);
  }

  all(): Content[] {
    return this.messages;
  }

  clear(): void {
    this.messages = [];
  }
}
