import React from 'react';
import { render, screen } from '@testing-library/react';
import { TypingIndicator } from '@nova/ui';

describe('TypingIndicator', () => {
  it('renders correctly with default agent name', () => {
    render(<TypingIndicator />);

    expect(screen.getByTestId('typing-indicator')).toBeInTheDocument();
    expect(screen.getByText(/NOVA is typing/i)).toBeInTheDocument();
  });

  it('renders with custom agent name', () => {
    render(<TypingIndicator agentName="Coach" />);

    expect(screen.getByText(/Coach is typing/i)).toBeInTheDocument();
  });

  it('renders animated dots', () => {
    render(<TypingIndicator />);

    const container = screen.getByTestId('typing-indicator');
    const dots = container.querySelectorAll('.animate-bounce');

    expect(dots.length).toBe(3);
  });
});
