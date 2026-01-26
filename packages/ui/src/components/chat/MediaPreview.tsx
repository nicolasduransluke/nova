import React from 'react';

export interface MediaPreviewProps {
  imageUrl: string;
  onRemove: () => void;
  alt?: string;
}

export function MediaPreview({ imageUrl, onRemove, alt = 'Preview' }: MediaPreviewProps) {
  return (
    <div
      className="relative inline-block m-2"
      data-testid="media-preview"
    >
      <img
        src={imageUrl}
        alt={alt}
        className="w-20 h-20 object-cover rounded-lg border-2 border-gray-200 dark:border-gray-700"
      />
      <button
        type="button"
        onClick={onRemove}
        className="
          absolute -top-2 -right-2
          w-6 h-6 rounded-full
          bg-red-500 hover:bg-red-600
          text-white text-sm font-bold
          flex items-center justify-center
          transition-colors
          shadow-md
        "
        aria-label="Remove image"
        data-testid="media-preview-remove"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
