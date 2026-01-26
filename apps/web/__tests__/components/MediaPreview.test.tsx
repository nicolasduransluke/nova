import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MediaPreview } from '@nova/ui';

describe('MediaPreview', () => {
  const mockOnRemove = jest.fn();
  const imageUrl = 'https://example.com/test-image.jpg';

  beforeEach(() => {
    mockOnRemove.mockClear();
  });

  it('renders correctly', () => {
    render(<MediaPreview imageUrl={imageUrl} onRemove={mockOnRemove} />);

    expect(screen.getByTestId('media-preview')).toBeInTheDocument();
  });

  it('displays the image', () => {
    render(<MediaPreview imageUrl={imageUrl} onRemove={mockOnRemove} />);

    const image = screen.getByRole('img');
    expect(image).toHaveAttribute('src', imageUrl);
  });

  it('displays custom alt text', () => {
    render(
      <MediaPreview
        imageUrl={imageUrl}
        onRemove={mockOnRemove}
        alt="Custom alt text"
      />
    );

    const image = screen.getByRole('img');
    expect(image).toHaveAttribute('alt', 'Custom alt text');
  });

  it('displays default alt text', () => {
    render(<MediaPreview imageUrl={imageUrl} onRemove={mockOnRemove} />);

    const image = screen.getByRole('img');
    expect(image).toHaveAttribute('alt', 'Preview');
  });

  it('calls onRemove when remove button is clicked', () => {
    render(<MediaPreview imageUrl={imageUrl} onRemove={mockOnRemove} />);

    const removeButton = screen.getByTestId('media-preview-remove');
    fireEvent.click(removeButton);

    expect(mockOnRemove).toHaveBeenCalledTimes(1);
  });

  it('remove button has accessible label', () => {
    render(<MediaPreview imageUrl={imageUrl} onRemove={mockOnRemove} />);

    const removeButton = screen.getByRole('button', { name: /remove image/i });
    expect(removeButton).toBeInTheDocument();
  });
});
