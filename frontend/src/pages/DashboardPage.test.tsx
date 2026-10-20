import { render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import DashboardPage from './DashboardPage';
import * as statsService from '../services/statsService';
import type { Game, Stats } from '../types';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, email: 'a@b.c', full_name: 'Asha' } }),
}));
vi.mock('../services/statsService');

const stats: Stats = {
  total_games: 1,
  wins: 1,
  losses: 0,
  draws: 0,
  by_difficulty: {
    easy: { wins: 1, losses: 0, draws: 0 },
    medium: { wins: 0, losses: 0, draws: 0 },
  },
  avg_captured: 5,
  current_streak: 1,
};

const makeGame = (id: number, status: Game['status']): Game => ({
  id,
  user_id: 1,
  difficulty: 'easy',
  board: [],
  human_score: 3,
  ai_score: 2,
  current_player: 'human',
  status,
  created_at: '',
  updated_at: '',
  finished_at: null,
});

const renderPage = () =>
  render(
    <ChakraProvider>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </ChakraProvider>,
  );

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('shows greeting, resume link and recent games', async () => {
    vi.mocked(statsService.getStats).mockResolvedValue(stats);
    vi.mocked(statsService.getInProgressGame).mockResolvedValue(makeGame(7, 'in_progress'));
    vi.mocked(statsService.getRecentGames).mockResolvedValue([makeGame(7, 'in_progress'), makeGame(6, 'human_won')]);
    renderPage();
    expect(await screen.findByText('Welcome back, Asha')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Resume game' })).toHaveAttribute('href', '/games/7');
    expect(screen.getByRole('link', { name: 'View all' })).toHaveAttribute('href', '/games');
    expect(screen.getByText('Won')).toBeInTheDocument();
  });

  it('shows new game CTA and empty state', async () => {
    vi.mocked(statsService.getStats).mockResolvedValue(stats);
    vi.mocked(statsService.getInProgressGame).mockResolvedValue(null);
    vi.mocked(statsService.getRecentGames).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByRole('link', { name: 'New game' })).toHaveAttribute('href', '/games/new');
    expect(screen.getByText(/No games yet/)).toBeInTheDocument();
  });

  it('shows an error state', async () => {
    vi.mocked(statsService.getStats).mockRejectedValue(new Error('x'));
    vi.mocked(statsService.getInProgressGame).mockResolvedValue(null);
    vi.mocked(statsService.getRecentGames).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText(/Could not load/)).toBeInTheDocument();
  });
});
