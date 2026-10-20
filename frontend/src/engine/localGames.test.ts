import {
  abandonGame,
  createGame,
  getGame,
  getStats,
  listGames,
  LocalGameError,
  playMove,
  resetLocalGames,
} from './localGames';
import type { MoveResult } from '../types';

beforeEach(() => {
  resetLocalGames();
});

const firstPlayableCup = (board: number[]): number => board.findIndex((n, i) => i < 7 && n > 0);

/** Plays a game to the end (always the first playable cup) and returns every response. */
function playOut(id: number): MoveResult[] {
  const responses: MoveResult[] = [];
  let game = getGame(id);
  for (let i = 0; i < 2000 && game.status === 'in_progress'; i += 1) {
    const res = playMove(id, { cup_index: firstPlayableCup(game.board) });
    responses.push(res);
    game = res.game;
  }
  return responses;
}

describe('local games', () => {
  it('starts a game on a fresh 5-seed board with the human to move', () => {
    const game = createGame({ difficulty: 'medium' });
    expect(game).toMatchObject({
      id: 1,
      difficulty: 'medium',
      board: new Array(14).fill(5),
      human_score: 0,
      ai_score: 0,
      current_player: 'human',
      status: 'in_progress',
    });
    expect(getGame(game.id).moves).toEqual([]);
  });

  it('plays the human move then the AI reply, with traces for the animation', () => {
    const { id } = createGame({ difficulty: 'easy' });
    const res = playMove(id, { cup_index: 0 });
    expect(res.human_move).toMatchObject({ player: 'human', cup_index: 0, seeds_sown: 5, move_number: 1 });
    expect(res.human_trace?.[0]).toEqual({ kind: 'pickup', cup: 0, count: 5 });
    expect(res.ai_move).toMatchObject({ player: 'ai', move_number: 2 });
    expect(res.ai_trace?.[0]?.kind).toBe('pickup');
    expect(res.sweep).toEqual([]);
    const total = res.game.board.reduce((n, x) => n + x, 0) + res.game.human_score + res.game.ai_score;
    expect(total).toBe(70);
    expect(getGame(id).moves).toHaveLength(2);
  });

  it('rejects illegal moves with a readable message', () => {
    const { id } = createGame({ difficulty: 'easy' });
    expect(() => playMove(id, { cup_index: 9 })).toThrow("Cannot play the opponent's cup");
    expect(() => playMove(id, { cup_index: 20 })).toThrow('Cup index out of range');
    expect(() => playMove(999, { cup_index: 0 })).toThrow(LocalGameError);
    try {
      playMove(999, { cup_index: 0 });
    } catch (err) {
      expect((err as LocalGameError).response.data.detail).toBe('Game not found');
    }
  });

  it('plays to a finish whose sweep explains the final scores', () => {
    const { id } = createGame({ difficulty: 'easy' });
    const responses = playOut(id);
    const last = responses[responses.length - 1] as MoveResult;
    expect(['human_won', 'ai_won', 'draw']).toContain(last.game.status);
    expect(last.game.board).toEqual(new Array(14).fill(0));
    expect(last.game.human_score + last.game.ai_score).toBe(70);
    expect(last.game.finished_at).not.toBeNull();

    let human = 0;
    let ai = 0;
    for (const r of responses) {
      human += r.human_move.seeds_captured;
      ai += r.ai_move?.seeds_captured ?? 0;
    }
    for (const s of last.sweep ?? []) {
      if (s.owner === 'human') human += s.count;
      else ai += s.count;
    }
    expect(last.game.human_score).toBe(human);
    expect(last.game.ai_score).toBe(ai);
    expect(() => playMove(id, { cup_index: 0 })).toThrow('Game is not in progress');
  });

  it('ends a game of chasing seeds as a stalemate instead of looping forever', () => {
    // Medium-vs-first-cup can chase single seeds; whatever the path, every game must end.
    for (let g = 0; g < 15; g += 1) {
      const { id } = createGame({ difficulty: 'medium' });
      playOut(id);
      expect(getGame(id).status).not.toBe('in_progress');
    }
  });

  it('lists newest first, filters by status and paginates', () => {
    const a = createGame({ difficulty: 'easy' });
    createGame({ difficulty: 'easy' });
    const c = createGame({ difficulty: 'medium' });
    abandonGame(a.id);
    expect(listGames().items.map((g) => g.id)).toEqual([c.id, 2, a.id]);
    expect(listGames({ status: 'abandoned' }).items.map((g) => g.id)).toEqual([a.id]);
    const page = listGames({ page: 2, page_size: 2 });
    expect(page).toMatchObject({ total: 3, page: 2, page_size: 2 });
    expect(page.items).toHaveLength(1);
    expect(listGames().items[0]).not.toHaveProperty('moves');
    expect(() => abandonGame(a.id)).toThrow('Game is not in progress');
  });

  it('survives a reload because games are stored on the device', () => {
    const { id } = createGame({ difficulty: 'easy' });
    playMove(id, { cup_index: 1 });
    const stored = window.localStorage.getItem('pallankuzhi.games.v1');
    expect(stored).toContain('"cup_index":1');
    expect(getGame(id).moves).toHaveLength(2);
  });
});

describe('local stats', () => {
  it('is all zeros before any game is finished', () => {
    createGame({ difficulty: 'easy' });
    expect(getStats()).toEqual({
      total_games: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      by_difficulty: {
        easy: { wins: 0, losses: 0, draws: 0 },
        medium: { wins: 0, losses: 0, draws: 0 },
      },
      avg_captured: 0,
      current_streak: 0,
    });
  });

  it('counts finished games by difficulty and ignores abandoned ones', () => {
    const finishedIds: number[] = [];
    for (const difficulty of ['easy', 'medium', 'easy'] as const) {
      const { id } = createGame({ difficulty });
      playOut(id);
      finishedIds.push(id);
    }
    abandonGame(createGame({ difficulty: 'easy' }).id);

    const stats = getStats();
    expect(stats.total_games).toBe(3);
    expect(stats.wins + stats.losses + stats.draws).toBe(3);
    const byDifficulty = stats.by_difficulty;
    expect(
      byDifficulty.easy.wins + byDifficulty.easy.losses + byDifficulty.easy.draws,
    ).toBe(2);
    expect(
      byDifficulty.medium.wins + byDifficulty.medium.losses + byDifficulty.medium.draws,
    ).toBe(1);
    expect(stats.avg_captured).toBeGreaterThan(0);
    expect(stats.current_streak).toBeGreaterThanOrEqual(0);
  });
});
