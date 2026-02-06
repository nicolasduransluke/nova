import React from 'react';

export interface ChatHeaderProps {
  title?: string;
  subtitle?: string;
  avatarUrl?: string;
  onBack?: () => void;
  onSettings?: () => void;
  onProfile?: () => void;
  onHistory?: () => void;
  onLogout?: () => void;
}

export function ChatHeader({
  title = 'NOVA',
  subtitle = 'Your Health Coach',
  avatarUrl,
  onBack,
  onSettings,
  onProfile,
  onHistory,
  onLogout,
}: ChatHeaderProps) {
  return (
    <header
      className="
        flex items-center px-4 py-3
        bg-white dark:bg-gray-900
        border-b border-gray-200 dark:border-gray-700
        shadow-sm
      "
      data-testid="chat-header"
    >
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="
            p-2 -ml-2 mr-2 rounded-full
            text-gray-600 dark:text-gray-300
            hover:bg-gray-100 dark:hover:bg-gray-800
            transition-colors
          "
          aria-label="Go back"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      )}

      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mr-3">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={title}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <span className="text-lg font-bold text-white">N</span>
        )}
      </div>

      {/* Title & Subtitle */}
      <div className="flex-1 min-w-0">
        <h1 className="text-base font-semibold text-gray-900 dark:text-white truncate">
          {title}
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {subtitle}
        </p>
      </div>

      {onProfile && (
        <button
          type="button"
          onClick={onProfile}
          className="
            p-2 rounded-full
            text-gray-600 dark:text-gray-300
            hover:bg-gray-100 dark:hover:bg-gray-800
            transition-colors
          "
          aria-label="Profile"
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
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </button>
      )}

      {onHistory && (
        <button
          type="button"
          onClick={onHistory}
          className="
            p-2 rounded-full
            text-gray-600 dark:text-gray-300
            hover:bg-gray-100 dark:hover:bg-gray-800
            transition-colors
          "
          aria-label="Historial"
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
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </button>
      )}

      {onSettings && (
        <button
          type="button"
          onClick={onSettings}
          className="
            p-2 rounded-full
            text-gray-600 dark:text-gray-300
            hover:bg-gray-100 dark:hover:bg-gray-800
            transition-colors
          "
          aria-label="Resumen"
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
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
        </button>
      )}

      {onLogout && (
        <button
          type="button"
          onClick={onLogout}
          className="
            p-2 -mr-2 rounded-full
            text-gray-600 dark:text-gray-300
            hover:bg-gray-100 dark:hover:bg-gray-800
            transition-colors
          "
          aria-label="Cerrar sesión"
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
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      )}
    </header>
  );
}
