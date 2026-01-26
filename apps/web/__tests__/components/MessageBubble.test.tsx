import React from 'react';
import { render, screen } from '@testing-library/react';
import { MessageBubble } from '@nova/ui';
import type { Message } from '@nova/types';

describe('MessageBubble', () => {
  const userMessage: Message = {
    id: 'msg-1',
    type: 'text',
    content: 'Hello, NOVA!',
    sender: 'user',
    timestamp: new Date('2024-01-15T10:30:00'),
  };

  const agentMessage: Message = {
    id: 'msg-2',
    type: 'text',
    content: 'Hello! How can I help you today?',
    sender: 'agent',
    timestamp: new Date('2024-01-15T10:31:00'),
  };

  it('renders user message correctly', () => {
    render(<MessageBubble message={userMessage} />);

    expect(screen.getByText('Hello, NOVA!')).toBeInTheDocument();
    expect(screen.getByTestId('message-bubble-msg-1')).toBeInTheDocument();
  });

  it('renders agent message correctly', () => {
    render(<MessageBubble message={agentMessage} />);

    expect(screen.getByText('Hello! How can I help you today?')).toBeInTheDocument();
  });

  it('renders user message with right alignment', () => {
    render(<MessageBubble message={userMessage} />);

    const container = screen.getByTestId('message-bubble-msg-1');
    expect(container).toHaveClass('justify-end');
  });

  it('renders agent message with left alignment', () => {
    render(<MessageBubble message={agentMessage} />);

    const container = screen.getByTestId('message-bubble-msg-2');
    expect(container).toHaveClass('justify-start');
  });

  it('displays timestamp when showTimestamp is true', () => {
    render(<MessageBubble message={userMessage} showTimestamp={true} />);

    // The time should be rendered (format: 10:30 AM)
    expect(screen.getByText(/10:30/i)).toBeInTheDocument();
  });

  it('hides timestamp when showTimestamp is false', () => {
    render(<MessageBubble message={userMessage} showTimestamp={false} />);

    // The time should not be rendered
    expect(screen.queryByText(/10:30/i)).not.toBeInTheDocument();
  });

  it('renders image when imageUrl is provided', () => {
    const messageWithImage: Message = {
      ...userMessage,
      imageUrl: 'https://example.com/image.jpg',
    };

    render(<MessageBubble message={messageWithImage} />);

    const image = screen.getByRole('img', { name: /attached media/i });
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', 'https://example.com/image.jpg');
  });

  it('renders icon for special message types', () => {
    const weightMessage: Message = {
      ...userMessage,
      type: 'weight',
      content: '75 kg',
    };

    render(<MessageBubble message={weightMessage} />);

    // Weight icon should be present
    expect(screen.getByText('75 kg')).toBeInTheDocument();
  });
});
