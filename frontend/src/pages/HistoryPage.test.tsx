import { fireEvent, render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import HistoryPage from './HistoryPage';
import * as gameService from '../services/gameService';
import type { Game, PaginatedGames } from '../types';

vi.mock('../services/gameService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/gameService')>();
  return { ...actual, listGames: vi.fn() };
});

const makeGame = (id: number, status: Game['status']): Game => ({
  id,
  user_id: 1,
  difficulty: 'medium',
  board: [],
  human_score: 35,
  ai_score: 25,
  current_player: 'human',
  status,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '',
  finished_at: null,
});

const page = (items: Game[], total: number, pageNo = 1): PaginatedGames => ({
  items,
  total,
  page: pageNo,
  page_size: 10,
});

const renderPage = () =>
  render(
    <ChakraProvider>
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>
    </ChakraProvider>,
  );

describe('HistoryPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('lists games with resume and view links', async () => {
    vi.mocked(gameService.listGames).mockResolvedValue(
      page([makeGame(2, 'in_progress'), makeGame(1, 'human_won')], 2),
    );
    renderPage();
    expect(await screen.findByRole('link', { name: 'Resume' })).toHaveAttribute('href', '/games/2');
    expect(screen.getByRole('link', { name: 'View' })).toHaveAttribute('href', '/games/1');
    expect(screen.getAllByText('35 - 25')).toHaveLength(2);
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
    expect(gameService.listGames).toHaveBeenCalledWith({ page: 1, page_size: 10, status: undefined });
  });

  it('shows an empty state', async () => {
    vi.mocked(gameService.listGames).mockResolvedValue(page([], 0));
    renderPage();
    expect(await screen.findByText('No games found.')).toBeInTheDocument();
  });

  it('shows an error state', async () => {
    vi.mocked(gameService.listGames).mockRejectedValue(new Error('x'));
    renderPage();
    expect(await screen.findByText('Could not load games')).toBeInTheDocument();
  });

  it('filters by status and resets to page 1', async () => {
    vi.mocked(gameService.listGames).mockResolvedValue(page([makeGame(1, 'human_won')], 25));
    renderPage();
    await screen.findByText('Page 1 of 3');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Page 2 of 3');
    fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'abandoned' } });
    await screen.findByText('Page 1 of 3');
    expect(gameService.listGames).toHaveBeenLastCalledWith({ page: 1, page_size: 10, status: 'abandoned' });
  });

  it('paginates forwards and backwards', async () => {
    vi.mocked(gameService.listGames).mockResolvedValue(page([makeGame(1, 'draw')], 25));
    renderPage();
    await screen.findByText('Page 1 of 3');
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Page 2 of 3');
    expect(gameService.listGames).toHaveBeenLastCalledWith({ page: 2, page_size: 10, status: undefined });
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    await screen.findByText('Page 1 of 3');
  });
});
