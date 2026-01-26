import React from 'react';
import { render, screen } from '@testing-library/react';
import { DateSeparator } from '@nova/ui';

describe('DateSeparator', () => {
  it('renders correctly', () => {
    render(<DateSeparator date={new Date()} />);

    expect(screen.getByTestId('date-separator')).toBeInTheDocument();
  });

  it('displays "Today" for current date', () => {
    render(<DateSeparator date={new Date()} />);

    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('displays "Yesterday" for yesterday\'s date', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    render(<DateSeparator date={yesterday} />);

    expect(screen.getByText('Yesterday')).toBeInTheDocument();
  });

  it('displays weekday name for dates within last week', () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    render(<DateSeparator date={threeDaysAgo} />);

    // Should show the weekday name (e.g., "Monday", "Tuesday")
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const expectedWeekday = weekdays[threeDaysAgo.getDay()];

    expect(screen.getByText(expectedWeekday)).toBeInTheDocument();
  });

  it('displays formatted date for older dates', () => {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    render(<DateSeparator date={twoWeeksAgo} />);

    // Should show formatted date (e.g., "Jan 1")
    const expectedDate = twoWeeksAgo.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });

    expect(screen.getByText(expectedDate)).toBeInTheDocument();
  });
});
