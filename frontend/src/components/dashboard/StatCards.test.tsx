import { render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { StatCards } from './StatCards';
import type { Stats } from '../../types';

const stats: Stats = {
  total_games: 10,
  wins: 6,
  losses: 3,
  draws: 1,
  by_difficulty: {
    easy: { wins: 4, losses: 0, draws: 1 },
    medium: { wins: 2, losses: 3, draws: 0 },
  },
  avg_captured: 12.34,
  current_streak: 2,
};

const renderCards = (s: Stats) =>
  render(
    <ChakraProvider>
      <StatCards stats={s} />
    </ChakraProvider>,
  );

describe('StatCards', () => {
  it('shows totals, win rate, streak and average', () => {
    renderCards(stats);
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText('2 wins')).toBeInTheDocument();
    expect(screen.getByText('12.3')).toBeInTheDocument();
    expect(screen.getByText('4W / 0L / 1D')).toBeInTheDocument();
    expect(screen.getByText('2W / 3L / 0D')).toBeInTheDocument();
  });

  it('handles zero games', () => {
    renderCards({
      ...stats,
      wins: 0,
      losses: 0,
      draws: 0,
      avg_captured: 0,
      current_streak: 0,
      by_difficulty: { easy: { wins: 0, losses: 0, draws: 0 }, medium: { wins: 0, losses: 0, draws: 0 } },
    });
    expect(screen.getByText('0%')).toBeInTheDocument();
  });
});
