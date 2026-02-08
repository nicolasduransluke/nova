import React, { useState, useMemo } from 'react';
import type { Message, MessageType, CalorieEntryItem } from '@nova/types';
import { parseFoodItemsFromText } from '../../lib/food-images';

export interface MessageBubbleProps {
  message: Message;
  showTimestamp?: boolean;
}

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function getMessageTypeIcon(type: MessageType): string | null {
  const icons: Record<MessageType, string | null> = {
    text: null,
    image: null,
    weight: '⚖️',
    sleep: '😴',
    meal: '🍽️',
    workout: '💪',
    energy: '⚡',
  };
  return icons[type];
}

function FoodItemCard({ item }: { item: CalorieEntryItem }) {
  const [imageError, setImageError] = useState(false);
  const hasImage = !!item.imageUrl && !imageError;

  return (
    <div className="flex items-center gap-2.5 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl p-2 mb-1.5">
      {hasImage ? (
        <img
          src={item.imageUrl}
          alt={item.name}
          className="w-12 h-12 rounded-lg object-cover"
          onError={() => setImageError(true)}
          loading="lazy"
        />
      ) : (
        <div className="w-12 h-12 rounded-lg bg-black/10 dark:bg-white/10 flex items-center justify-center text-xl">
          🍽️
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.name}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">~{item.calories} kcal</p>
      </div>
    </div>
  );
}

export function MessageBubble({ message, showTimestamp = true }: MessageBubbleProps) {
  const isUser = message.sender === 'user';
  const icon = getMessageTypeIcon(message.type);

  // Extract food items from metadata, or parse from text as fallback
  const apiFoodItems = message.metadata?.foodItems as CalorieEntryItem[] | undefined;
  const parsedFoodItems = useMemo(
    () => (!apiFoodItems && !isUser && message.content) ? parseFoodItemsFromText(message.content) : undefined,
    [apiFoodItems, isUser, message.content],
  );
  const foodItems = apiFoodItems || parsedFoodItems;
  const hasFoodCards = !isUser && foodItems && foodItems.length > 0;

  // Split message text: header, items (replaced by cards), summary
  let headerText = '';
  let summaryText = '';

  if (hasFoodCards && message.content) {
    const lines = message.content.split('\n');
    const headerLines: string[] = [];
    const summaryLines: string[] = [];
    let pastItems = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith('- ') && !pastItems) continue;
      if (trimmed.startsWith('Total:') || trimmed.startsWith('Total quemado:') ||
          trimmed.startsWith('Hoy:') || trimmed.startsWith('Today:')) {
        pastItems = true;
      }
      if (pastItems) {
        summaryLines.push(trimmed);
      } else {
        headerLines.push(trimmed);
      }
    }

    headerText = headerLines.join('\n');
    summaryText = summaryLines.join('\n');
  }

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}
      data-testid={`message-bubble-${message.id}`}
    >
      <div
        className={`
          max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-2.5
          ${isUser
            ? 'bg-blue-500 text-white rounded-br-md'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-md'
          }
        `}
      >
        {icon && (
          <span className="text-sm mr-1.5" aria-hidden="true">
            {icon}
          </span>
        )}

        {message.imageUrl && (
          <div className="mb-2">
            <img
              src={message.imageUrl}
              alt="Attached media"
              className="rounded-lg max-w-full h-auto max-h-64 object-cover"
              loading="lazy"
            />
          </div>
        )}

        {hasFoodCards ? (
          <>
            {headerText && (
              <p className="text-sm sm:text-base font-semibold mb-1.5 whitespace-pre-wrap">
                {headerText}
              </p>
            )}

            <div className="my-1.5">
              {foodItems.map((item, index) => (
                <FoodItemCard key={`${item.name}-${index}`} item={item} />
              ))}
            </div>

            {summaryText && (
              <p className="text-xs sm:text-sm text-gray-400 mt-1.5 whitespace-pre-wrap">
                {summaryText}
              </p>
            )}
          </>
        ) : message.content ? (
          <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap break-words">
            {message.content}
          </p>
        ) : null}

        {showTimestamp && (
          <p
            className={`
              text-xs mt-1.5
              ${isUser ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}
            `}
          >
            {formatTime(message.timestamp)}
          </p>
        )}
      </div>
    </div>
  );
}
