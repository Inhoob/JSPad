export interface Tab {
  id: string;
  name: string;
  code: string;
  consoleOutput: ConsoleMessage[];
}

export interface ConsoleMessage {
  line?: number;
  type: 'log' | 'error' | 'warn';
  content: any;
}

export interface Settings {
  autoExecute: boolean;
  autoExecuteDelay: number; // milliseconds: 500, 1000, 1500, 2000
  executionTimeout: number;
  splitRatio: number;
}

export type ExecutionMode = 'auto' | 'manual';
