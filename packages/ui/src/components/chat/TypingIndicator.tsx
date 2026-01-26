import React from 'react';

export interface TypingIndicatorProps {
  agentName?: string;
}

export function TypingIndicator({ agentName = 'NOVA' }: TypingIndicatorProps) {
  return (
    <div className="flex justify-start mb-3" data-testid="typing-indicator">
      <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-bl-md px-4 py-3">
        <div className="flex items-center space-x-1">
          <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">
            {agentName} is typing
          </span>
          <span
            className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"
            style={{ animationDelay: '0ms' }}
          />
          <span
            className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"
            style={{ animationDelay: '150ms' }}
          />
          <span
            className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"
            style={{ animationDelay: '300ms' }}
          />
        </div>
      </div>
    </div>
  );
}
