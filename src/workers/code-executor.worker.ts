interface ExecuteMessage {
  type: 'execute';
  code: string;
  timeout: number;
}

interface TerminateMessage {
  type: 'terminate';
}

type WorkerMessage = ExecuteMessage | TerminateMessage;

interface ConsoleMessage {
  type: 'log' | 'error' | 'warn';
  content: string;
}

const MAX_LOGS = 1000;
let logs: ConsoleMessage[] = [];

// Override console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalSetTimeout = self.setTimeout.bind(self);
const originalSetInterval = self.setInterval.bind(self);
const originalClearTimeout = self.clearTimeout.bind(self);
const originalClearInterval = self.clearInterval.bind(self);

let pendingTimers = new Set<number>();

console.log = (...args: any[]) => {
  if (logs.length >= MAX_LOGS) {
    if (logs.length === MAX_LOGS) {
      logs.push({
        type: 'warn',
        content: `⚠️ Log limit reached (${MAX_LOGS} lines). Further logs will be ignored.`,
      });
    }
    return;
  }

  const content = args.map(arg => {
    // Check if it's a Promise
    if (arg && typeof arg === 'object' && typeof arg.then === 'function') {
      // It's a Promise, track its state
      const promiseId = Math.random().toString(36).substring(7);
      const initialContent = `Promise { <pending> }`;

      // Track the promise resolution
      arg.then(
        (value: any) => {
          const resolvedContent = typeof value === 'object'
            ? JSON.stringify(value, null, 2)
            : String(value);
          console.log(`Promise resolved: ${resolvedContent}`);
        },
        (error: any) => {
          console.error(`Promise rejected: ${String(error)}`);
        }
      );

      return initialContent;
    }

    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg, null, 2);
      } catch {
        return String(arg);
      }
    }
    return String(arg);
  }).join(' ');

  logs.push({ type: 'log', content });
  originalConsoleLog('[User Code]', content);
};

console.error = (...args: any[]) => {
  if (logs.length >= MAX_LOGS + 1) return;

  const content = args.map(arg => String(arg)).join(' ');
  logs.push({ type: 'error', content });
  originalConsoleError('[User Code Error]', content);
};

console.warn = (...args: any[]) => {
  if (logs.length >= MAX_LOGS + 1) return;

  const content = args.map(arg => String(arg)).join(' ');
  logs.push({ type: 'warn', content });
  originalConsoleWarn('[User Code Warn]', content);
};

// Polyfill DOM APIs
(self as any).alert = (message: any) => {
  console.log(`[alert] ${String(message)}`);
};

(self as any).confirm = (message: any) => {
  console.log(`[confirm] ${String(message)} (returned true)`);
  return true;
};

(self as any).prompt = (message: any, defaultValue?: any) => {
  const value = defaultValue || '';
  console.log(`[prompt] ${String(message)} (returned "${value}")`);
  return value;
};

// Track timers
(self as any).setTimeout = (callback: any, delay?: number, ...args: any[]) => {
  const wrappedCallback = () => {
    try {
      callback(...args);
    } finally {
      pendingTimers.delete(id);
      originalConsoleLog('[WORKER] Timer completed, pending:', pendingTimers.size);
    }
  };
  const id = originalSetTimeout(wrappedCallback, delay || 0);
  pendingTimers.add(id);
  originalConsoleLog('[WORKER] Timer added, pending:', pendingTimers.size);
  return id;
};

(self as any).setInterval = (callback: any, delay?: number, ...args: any[]) => {
  const id = originalSetInterval(callback, delay || 0, ...args);
  pendingTimers.add(id);
  originalConsoleLog('[WORKER] Interval added, pending:', pendingTimers.size);
  return id;
};

(self as any).clearTimeout = (id: number) => {
  originalClearTimeout(id);
  pendingTimers.delete(id);
  originalConsoleLog('[WORKER] Timer cleared, pending:', pendingTimers.size);
};

(self as any).clearInterval = (id: number) => {
  originalClearInterval(id);
  pendingTimers.delete(id);
  originalConsoleLog('[WORKER] Interval cleared, pending:', pendingTimers.size);
};

originalConsoleLog('[WORKER] Code executor worker loaded');

self.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
  originalConsoleLog('[WORKER] Received message:', event.data.type);

  const message = event.data;

  if (message.type === 'terminate') {
    originalConsoleLog('[WORKER] Terminating');
    self.close();
    return;
  }

  if (message.type === 'execute') {
    logs = [];
    pendingTimers.clear();
    originalConsoleLog('[WORKER] Executing code...');

    const sendResults = () => {
      originalConsoleLog('[WORKER] Sending results, logs:', logs.length);
      self.postMessage({
        type: 'complete',
        logs: logs
      });
    };

    // Safety timeout
    const safetyTimeout = originalSetTimeout(() => {
      originalConsoleLog('[WORKER] Safety timeout reached');
      pendingTimers.forEach(id => {
        originalClearTimeout(id);
        originalClearInterval(id);
      });
      pendingTimers.clear();
      sendResults();
    }, message.timeout);

    const executeAsync = async () => {
      try {
        // Execute code as async function to support await and fetch
        const fn = new Function(`return (async () => { ${message.code} })();`);
        await fn();

        originalConsoleLog('[WORKER] Code executed, pending timers:', pendingTimers.size);

        // Wait a bit for any remaining async operations
        await new Promise(resolve => originalSetTimeout(resolve, 100));

        if (pendingTimers.size === 0) {
          // No async operations, send immediately
          originalClearTimeout(safetyTimeout);
          sendResults();
        } else {
          // Wait for timers to complete
          const checkInterval = originalSetInterval(() => {
            originalConsoleLog('[WORKER] Checking timers, pending:', pendingTimers.size);
            if (pendingTimers.size === 0) {
              originalClearInterval(checkInterval);
              originalClearTimeout(safetyTimeout);
              sendResults();
            }
          }, 50);
        }
      } catch (error: any) {
        originalConsoleError('[WORKER] Execution error:', error);
        originalClearTimeout(safetyTimeout);
        logs.push({
          type: 'error',
          content: error.message || String(error),
        });
        sendResults();
      }
    };

    executeAsync();
  }
});

export {};
