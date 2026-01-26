'use client';

import React, { useState, useRef, useCallback } from 'react';
import { MediaPreview } from './MediaPreview';

export interface MessageInputProps {
  onSend: (content: string, imageUrl?: string) => void;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
}

export function MessageInput({
  onSend,
  disabled = false,
  placeholder = 'Type a message...',
  maxLength = 2000,
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleImageSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
    // Reset input so same file can be selected again
    event.target.value = '';
  }, []);

  const handleRemoveImage = useCallback(() => {
    setImagePreview(null);
  }, []);

  const handleSend = useCallback(() => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage && !imagePreview) return;

    onSend(trimmedMessage, imagePreview || undefined);
    setMessage('');
    setImagePreview(null);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [message, imagePreview, onSend]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleTextChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = event.target.value;
      if (value.length <= maxLength) {
        setMessage(value);

        // Auto-resize textarea
        const textarea = event.target;
        textarea.style.height = 'auto';
        textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
      }
    },
    [maxLength]
  );

  const handleCameraClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const canSend = (message.trim().length > 0 || imagePreview) && !disabled;

  return (
    <div
      className="
        border-t border-gray-200 dark:border-gray-700
        bg-white dark:bg-gray-900
        px-4 py-3
      "
      data-testid="message-input"
    >
      {imagePreview && (
        <div className="mb-2">
          <MediaPreview imageUrl={imagePreview} onRemove={handleRemoveImage} />
        </div>
      )}

      <div className="flex items-end space-x-2">
        {/* Camera/Image Button */}
        <button
          type="button"
          onClick={handleCameraClick}
          disabled={disabled}
          className="
            p-2.5 rounded-full
            text-gray-500 hover:text-gray-700
            dark:text-gray-400 dark:hover:text-gray-200
            hover:bg-gray-100 dark:hover:bg-gray-800
            transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed
          "
          aria-label="Attach image"
          data-testid="camera-button"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleImageSelect}
          className="hidden"
          aria-hidden="true"
        />

        {/* Text Input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={placeholder}
            rows={1}
            className="
              w-full px-4 py-2.5
              bg-gray-100 dark:bg-gray-800
              text-gray-900 dark:text-gray-100
              placeholder-gray-500 dark:placeholder-gray-400
              rounded-2xl
              resize-none
              focus:outline-none focus:ring-2 focus:ring-blue-500
              disabled:opacity-50 disabled:cursor-not-allowed
              text-sm sm:text-base
            "
            style={{ maxHeight: '120px' }}
            data-testid="message-textarea"
          />
        </div>

        {/* Send Button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className="
            p-2.5 rounded-full
            bg-blue-500 hover:bg-blue-600
            text-white
            transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed
            disabled:bg-gray-300 dark:disabled:bg-gray-700
          "
          aria-label="Send message"
          data-testid="send-button"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>

      {/* Character count */}
      {message.length > maxLength * 0.8 && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
          {message.length}/{maxLength}
        </p>
      )}
    </div>
  );
}
