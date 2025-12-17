import { useRef } from 'react';
import type { ConsoleMessage } from '../types';

interface ConsolePanelProps {
  output: ConsoleMessage[];
  onScroll?: (scrollTop: number) => void;
}

export function ConsolePanel({ output, onScroll }: ConsolePanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    if (containerRef.current && onScroll) {
      onScroll(containerRef.current.scrollTop);
    }
  };

  const getTextColor = (type: ConsoleMessage['type']) => {
    switch (type) {
      case 'error':
        return 'text-red-400';
      case 'warn':
        return 'text-yellow-400';
      default:
        return 'text-dark-text';
    }
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-auto bg-dark-bg p-4 font-mono text-sm"
      onScroll={handleScroll}
    >
      <div className="space-y-1">
        {output.map((msg, index) => (
          <div
            key={index}
            className={`${getTextColor(msg.type)} whitespace-pre-wrap`}
          >
            {msg.content}
          </div>
        ))}
      </div>
    </div>
  );
}
