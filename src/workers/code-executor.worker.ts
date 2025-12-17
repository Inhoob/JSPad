interface ExecuteMessage {
  type: 'execute';
  code: string;
  timeout: number;
}

interface TerminateMessage {
  type: 'terminate';
}

type WorkerMessage = ExecuteMessage | TerminateMessage;

interface OutputMessage {
  type: 'log' | 'error' | 'warn';
  line: number;
  content: any;
}

const logCache: OutputMessage[] = [];
let executionTimeout: number | null = null;

// Override console methods
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

function getLineNumber(): number {
  try {
    const stack = new Error().stack;
    if (!stack) return 0;

    const lines = stack.split('\n');
    // Find the line that contains 'eval' which is our executed code
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('eval')) {
        const match = lines[i].match(/:(\d+):/);
        if (match) {
          return parseInt(match[1], 10);
        }
      }
    }
    return 0;
  } catch {
    return 0;
  }
}

console.log = (...args: any[]) => {
  const content = args.map(arg => {
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg, null, 2);
      } catch {
        return String(arg);
      }
    }
    return String(arg);
  }).join(' ');

  logCache.push({
    type: 'log',
    line: getLineNumber(),
    content,
  });
};

console.error = (...args: any[]) => {
  const content = args.map(arg => String(arg)).join(' ');
  logCache.push({
    type: 'error',
    line: getLineNumber(),
    content,
  });
};

console.warn = (...args: any[]) => {
  const content = args.map(arg => String(arg)).join(' ');
  logCache.push({
    type: 'warn',
    line: getLineNumber(),
    content,
  });
};

self.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  if (message.type === 'terminate') {
    if (executionTimeout) {
      clearTimeout(executionTimeout);
    }
    self.close();
    return;
  }

  if (message.type === 'execute') {
    logCache.length = 0;

    executionTimeout = setTimeout(() => {
      logCache.push({
        type: 'error',
        line: 0,
        content: 'Execution timeout',
      });
      self.postMessage({ type: 'complete', logs: logCache });
    }, message.timeout) as unknown as number;

    try {
      const fn = new Function(message.code);
      fn();
    } catch (error: any) {
      logCache.push({
        type: 'error',
        line: 0,
        content: error.message || String(error),
      });
    } finally {
      if (executionTimeout) {
        clearTimeout(executionTimeout);
      }
    }

    self.postMessage({ type: 'complete', logs: logCache });
  }
});

export {};
