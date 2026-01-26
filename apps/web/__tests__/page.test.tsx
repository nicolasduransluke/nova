import { render, screen } from '@testing-library/react';
import Home from '../src/app/page';

// Mock the @nova/ui components
jest.mock('@nova/ui', () => ({
  Button: ({ children, ...props }: { children: React.ReactNode }) => (
    <button {...props}>{children}</button>
  ),
  Card: ({ children, ...props }: { children: React.ReactNode }) => (
    <div {...props}>{children}</div>
  ),
  NovaPointsBadge: ({ points }: { points: number }) => (
    <span>{points} NP</span>
  ),
}));

describe('Home Page', () => {
  it('renders the NOVA heading', () => {
    render(<Home />);

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('NOVA');
  });

  it('renders the subtitle', () => {
    render(<Home />);

    expect(screen.getByText('Human Energy Intelligence System')).toBeInTheDocument();
  });

  it('renders all feature cards', () => {
    render(<Home />);

    expect(screen.getByText('Track Your Energy')).toBeInTheDocument();
    expect(screen.getByText('AI Coaching')).toBeInTheDocument();
    expect(screen.getByText('Insights & Analytics')).toBeInTheDocument();
    expect(screen.getByText('NOVA Points')).toBeInTheDocument();
  });

  it('renders action buttons', () => {
    render(<Home />);

    expect(screen.getByRole('button', { name: /start tracking/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /meet your coach/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /earn points/i })).toBeInTheDocument();
  });

  it('renders the nova points badge', () => {
    render(<Home />);

    expect(screen.getByText('0 NP')).toBeInTheDocument();
  });

  it('renders the footer', () => {
    render(<Home />);

    expect(screen.getByText(/NOVA v0.1.0/)).toBeInTheDocument();
  });
});
