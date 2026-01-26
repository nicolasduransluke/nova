import React from 'react';

export interface DateSeparatorProps {
  date: Date;
}

function formatDate(date: Date): string {
  const now = new Date();
  const messageDate = new Date(date);
  const diffDays = Math.floor(
    (now.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return messageDate.toLocaleDateString('en-US', { weekday: 'long' });
  } else {
    return messageDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: messageDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  }
}

export function DateSeparator({ date }: DateSeparatorProps) {
  return (
    <div className="flex items-center justify-center my-4" data-testid="date-separator">
      <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
      <span className="px-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {formatDate(date)}
      </span>
      <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
    </div>
  );
}
