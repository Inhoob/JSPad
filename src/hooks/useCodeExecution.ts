import { useEffect, useRef, useCallback } from 'react';
import type { ConsoleMessage } from '../types';

interface UseCodeExecutionOptions {
  code: string;
  autoExecute: boolean;
  timeout: number;
  onOutput: (output: ConsoleMessage[]) => void;
}

export function useCodeExecution({
  code,
  autoExecute,
  timeout,
  onOutput,
}: UseCodeExecutionOptions) {
  const workerRef = useRef<Worker | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const executeCode = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
    }

    workerRef.current = new Worker(
      new URL('../workers/code-executor.worker.ts', import.meta.url),
      { type: 'module' }
    );

    workerRef.current.onmessage = (event) => {
      if (event.data.type === 'complete') {
        onOutput(event.data.logs);
      }
    };

    workerRef.current.postMessage({
      type: 'execute',
      code,
      timeout,
    });
  }, [code, timeout, onOutput]);

  useEffect(() => {
    if (!autoExecute) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      executeCode();
    }, 1500);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [code, autoExecute, executeCode]);

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { executeCode };
}
