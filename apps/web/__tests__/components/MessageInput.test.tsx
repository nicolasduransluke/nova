import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageInput } from '@nova/ui';

describe('MessageInput', () => {
  const mockOnSend = jest.fn();

  beforeEach(() => {
    mockOnSend.mockClear();
  });

  it('renders correctly', () => {
    render(<MessageInput onSend={mockOnSend} />);

    expect(screen.getByTestId('message-input')).toBeInTheDocument();
    expect(screen.getByTestId('message-textarea')).toBeInTheDocument();
    expect(screen.getByTestId('send-button')).toBeInTheDocument();
    expect(screen.getByTestId('camera-button')).toBeInTheDocument();
  });

  it('displays custom placeholder', () => {
    render(<MessageInput onSend={mockOnSend} placeholder="Custom placeholder" />);

    expect(screen.getByPlaceholderText('Custom placeholder')).toBeInTheDocument();
  });

  it('calls onSend with message content when send button is clicked', async () => {
    render(<MessageInput onSend={mockOnSend} />);

    const textarea = screen.getByTestId('message-textarea');
    const sendButton = screen.getByTestId('send-button');

    await userEvent.type(textarea, 'Hello, NOVA!');
    await userEvent.click(sendButton);

    expect(mockOnSend).toHaveBeenCalledWith('Hello, NOVA!', undefined);
  });

  it('clears input after sending', async () => {
    render(<MessageInput onSend={mockOnSend} />);

    const textarea = screen.getByTestId('message-textarea') as HTMLTextAreaElement;

    await userEvent.type(textarea, 'Hello, NOVA!');
    await userEvent.click(screen.getByTestId('send-button'));

    expect(textarea.value).toBe('');
  });

  it('does not send empty messages', async () => {
    render(<MessageInput onSend={mockOnSend} />);

    const sendButton = screen.getByTestId('send-button');
    await userEvent.click(sendButton);

    expect(mockOnSend).not.toHaveBeenCalled();
  });

  it('does not send whitespace-only messages', async () => {
    render(<MessageInput onSend={mockOnSend} />);

    const textarea = screen.getByTestId('message-textarea');
    await userEvent.type(textarea, '   ');
    await userEvent.click(screen.getByTestId('send-button'));

    expect(mockOnSend).not.toHaveBeenCalled();
  });

  it('sends message on Enter key press', async () => {
    render(<MessageInput onSend={mockOnSend} />);

    const textarea = screen.getByTestId('message-textarea');
    await userEvent.type(textarea, 'Hello!{enter}');

    expect(mockOnSend).toHaveBeenCalledWith('Hello!', undefined);
  });

  it('does not send on Shift+Enter (allows multiline)', async () => {
    render(<MessageInput onSend={mockOnSend} />);

    const textarea = screen.getByTestId('message-textarea');
    await userEvent.type(textarea, 'Line 1{shift>}{enter}{/shift}Line 2');

    expect(mockOnSend).not.toHaveBeenCalled();
  });

  it('disables input when disabled prop is true', () => {
    render(<MessageInput onSend={mockOnSend} disabled={true} />);

    const textarea = screen.getByTestId('message-textarea');
    const sendButton = screen.getByTestId('send-button');
    const cameraButton = screen.getByTestId('camera-button');

    expect(textarea).toBeDisabled();
    expect(sendButton).toBeDisabled();
    expect(cameraButton).toBeDisabled();
  });

  it('respects maxLength prop', async () => {
    render(<MessageInput onSend={mockOnSend} maxLength={10} />);

    const textarea = screen.getByTestId('message-textarea') as HTMLTextAreaElement;
    await userEvent.type(textarea, 'This is a very long message that exceeds the limit');

    expect(textarea.value.length).toBeLessThanOrEqual(10);
  });

  it('send button is disabled when input is empty', () => {
    render(<MessageInput onSend={mockOnSend} />);

    const sendButton = screen.getByTestId('send-button');
    expect(sendButton).toBeDisabled();
  });

  it('send button is enabled when input has content', async () => {
    render(<MessageInput onSend={mockOnSend} />);

    const textarea = screen.getByTestId('message-textarea');
    await userEvent.type(textarea, 'Hello');

    const sendButton = screen.getByTestId('send-button');
    expect(sendButton).not.toBeDisabled();
  });
});
