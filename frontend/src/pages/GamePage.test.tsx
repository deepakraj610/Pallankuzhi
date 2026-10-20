import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import GamePage from './GamePage';
import * as gameService from '../services/gameService';
import type { Game, Move, MoveResult } from '../types';

vi.mock('../services/gameService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/gameService')>();
  return { ...actual, getGame: vi.fn(), playMove: vi.fn(), abandonGame: vi.fn() };
});

const START = Array<number>(14).fill(5);

const makeGame = (overrides: Partial<Game> = {}): Game => ({
  id: 3,
  user_id: 1,
  difficulty: 'easy',
  board: START,
  human_score: 0,
  ai_score: 0,
  current_player: 'human',
  status: 'in_progress',
  created_at: '',
  updated_at: '',
  finished_at: null,
  moves: [],
  ...overrides,
});

const makeMove = (overrides: Partial<Move>): Move => ({
  id: 1,
  game_id: 3,
  move_number: 1,
  player: 'human',
  cup_index: 0,
  seeds_sown: 5,
  seeds_captured: 0,
  board_after: START,
  created_at: '',
  ...overrides,
});

const AFTER_HUMAN = [0, 6, 6, 6, 6, 6, 5, 5, 5, 5, 5, 5, 5, 5];
const AFTER_AI = [0, 6, 6, 6, 6, 6, 5, 0, 6, 6, 6, 6, 6, 5];

const moveResult: MoveResult = {
  game: makeGame({ board: AFTER_AI, human_score: 3, ai_score: 2 }),
  human_move: makeMove({ id: 1, seeds_captured: 3, board_after: AFTER_HUMAN }),
  ai_move: makeMove({
    id: 2,
    move_number: 2,
    player: 'ai',
    cup_index: 7,
    seeds_captured: 2,
    board_after: AFTER_AI,
  }),
};

const renderPage = () =>
  render(
    <ChakraProvider>
      <MemoryRouter initialEntries={['/games/3']}>
        <Routes>
          <Route path="/games/:id" element={<GamePage />} />
          <Route path="/games" element={<div>games list</div>} />
          <Route path="/games/new" element={<div>new game page</div>} />
        </Routes>
      </MemoryRouter>
    </ChakraProvider>,
  );

describe('GamePage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('loads the game and shows an enabled human board on your turn', async () => {
    vi.mocked(gameService.getGame).mockResolvedValue(makeGame());
    renderPage();
    expect(await screen.findByText('Your turn')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Your cup 1, 5 seeds' })).toBeEnabled();
    expect(screen.getByText('No moves yet.')).toBeInTheDocument();
  });

  it('shows an error when the game cannot be loaded', async () => {
    vi.mocked(gameService.getGame).mockRejectedValue(new Error('nope'));
    renderPage();
    expect(await screen.findByText('Could not load game')).toBeInTheDocument();
  });

  it('shows the human result first, then the AI reply', async () => {
    vi.mocked(gameService.getGame).mockResolvedValue(makeGame());
    vi.mocked(gameService.playMove).mockResolvedValue(moveResult);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Your cup 1, 5 seeds' }));
    expect(gameService.playMove).toHaveBeenCalledWith(3, { cup_index: 0 });

    // Human result is visible while the opponent has not replied yet.
    expect(await screen.findByRole('button', { name: 'Your cup 1, 0 seeds' })).toBeInTheDocument();
    expect(screen.getByTestId('human-score')).toHaveTextContent('3');
    expect(screen.getByTestId('ai-score')).toHaveTextContent('0');
    expect(screen.getByText(/You: cup 1, sowed 5, captured 3/)).toBeInTheDocument();
    expect(screen.queryByText(/Opponent: cup/)).not.toBeInTheDocument();
    expect(screen.getByText('Opponent is thinking...')).toBeInTheDocument();
    expect(screen.getByTestId('hourglass')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Your cup 2, 6 seeds' })).toBeDisabled();

    // Then the AI reply appears and the board is final.
    expect(
      await screen.findByText(/Opponent: cup 1, sowed 5, captured 2/, {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('ai-score')).toHaveTextContent('2');
    });
    expect(screen.getByRole('button', { name: 'Opponent cup 1, 0 seeds' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Your turn')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('hourglass')).not.toBeInTheDocument();
  });

  it('shows the server error and resyncs when a move fails', async () => {
    vi.mocked(gameService.getGame).mockResolvedValue(makeGame());
    vi.mocked(gameService.playMove).mockRejectedValue(
      Object.assign(new Error('bad'), { response: { data: { detail: 'Cannot play an empty cup' } } }),
    );
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Your cup 1, 5 seeds' }));
    expect(await screen.findByText('Cannot play an empty cup')).toBeInTheDocument();
    await waitFor(() => {
      expect(gameService.getGame).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByText('Your turn')).toBeInTheDocument();
  });

  it('falls back to a generic message for unknown move errors', async () => {
    vi.mocked(gameService.getGame).mockResolvedValue(makeGame());
    vi.mocked(gameService.playMove).mockRejectedValue(new Error('network'));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Your cup 1, 5 seeds' }));
    expect(await screen.findByText('Move failed')).toBeInTheDocument();
  });

  it('abandons the game and shows the game over dialog', async () => {
    vi.mocked(gameService.getGame)
      .mockResolvedValueOnce(makeGame())
      .mockResolvedValueOnce(makeGame({ status: 'abandoned' }));
    vi.mocked(gameService.abandonGame).mockResolvedValue(undefined);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Abandon game' }));
    expect(gameService.abandonGame).toHaveBeenCalledWith(3);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Game abandoned')).toBeInTheDocument();
  });

  it('reports an abandon failure', async () => {
    vi.mocked(gameService.getGame).mockResolvedValue(makeGame());
    vi.mocked(gameService.abandonGame).mockRejectedValue(new Error('x'));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Abandon game' }));
    expect(await screen.findByText('Could not abandon game')).toBeInTheDocument();
  });

  it('shows the result dialog for a finished game and navigates to play again', async () => {
    vi.mocked(gameService.getGame).mockResolvedValue(
      makeGame({ status: 'human_won', human_score: 40, ai_score: 30, board: Array<number>(14).fill(0) }),
    );
    renderPage();
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('You won!')).toBeInTheDocument();
    expect(within(dialog).getByText(/Final score: You 40 - Opponent 30/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abandon game' })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Play again' }));
    expect(await screen.findByText('new game page')).toBeInTheDocument();
  });
});
