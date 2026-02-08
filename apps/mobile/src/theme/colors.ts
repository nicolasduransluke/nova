export const colors = {
  // Gradient background
  gradient: {
    from: '#1e1b4b',    // nova-dark / indigo-950
    via: '#312e81',     // indigo-900
    to: '#581c87',      // purple-900
  },

  // Glass morphism
  glass: {
    bg: 'rgba(255, 255, 255, 0.1)',
    border: 'rgba(255, 255, 255, 0.2)',
    bgLight: 'rgba(255, 255, 255, 0.05)',
  },

  // Brand
  primary: '#9333ea',     // purple-600
  primaryLight: '#a855f7', // purple-500
  secondary: '#4f46e5',   // indigo-600
  secondaryLight: '#6366f1', // indigo-500

  // Text
  text: {
    primary: '#ffffff',
    secondary: '#c7d2fe',   // indigo-200
    muted: '#a5b4fc',       // indigo-300
    dimmed: '#818cf8',      // indigo-400
    placeholder: 'rgba(255, 255, 255, 0.5)',
  },

  // Status
  success: '#4ade80',     // green-400
  error: '#f87171',       // red-400
  warning: '#fbbf24',     // yellow-400

  // Chat
  chat: {
    userBubble: '#6366f1',  // indigo-500
    agentBubble: '#374151',  // gray-700
    background: '#111827',   // gray-900
    inputBg: '#1f2937',     // gray-800
    border: '#374151',       // gray-700
  },

  // Tabs
  tabBar: {
    bg: '#111827',          // gray-900
    active: '#a855f7',      // purple-500
    inactive: '#6b7280',    // gray-500
  },
} as const;
