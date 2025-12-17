export interface Tab {
  id: string;
  name: string;
  code: string;
  consoleOutput: ConsoleMessage[];
}

export interface ConsoleMessage {
  line: number;
  type: 'log' | 'error' | 'warn';
  content: any;
}

export interface Settings {
  autoExecute: boolean;
  executionTimeout: number;
  splitRatio: number;
}

export type ExecutionMode = 'auto' | 'manual';
