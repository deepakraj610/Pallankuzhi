/**
 * On-device game store for the standalone (offline) app. Mirrors the backend games + stats API
 * (backend/app/services/game_service.py and stats_service.py) on top of localStorage, using the
 * TypeScript engine, so no server is needed.
 */
import type {
  CreateGamePayload,
  Difficulty,
  Game,
  GameListParams,
  GameStatus,
  Move,
  MovePayload,
  MoveResult,
  PaginatedGames,
  Stats,
  SweepStep,
  TraceStep,
} from '../types';
import { chooseMove } from './ai';
import {
  applyMove,
  finalResult,
  newBoard,
  STALEMATE_MOVES,
  validMoves,
  type MoveResult as EngineMove,
} from './engine';

const STORAGE_KEY = 'pallankuzhi.games.v1';
const LOCAL_USER_ID = 1;

interface Store {
  nextGameId: number;
  nextMoveId: number;
  games: Game[];
}

/** Errors shaped like the server's so `extractError` can show their message. */
export class LocalGameError extends Error {
  readonly response: { data: { detail: string } };

  constructor(detail: string) {
    super(detail);
    this.response = { data: { detail } };
  }
}

// Falls back to memory when storage is unavailable (private mode, blocked site data).
let memory: Store = { nextGameId: 1, nextMoveId: 1, games: [] };

function load(): Store {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch {
    // fall through to the in-memory copy
  }
  return memory;
}

function save(store: Store): void {
  memory = store;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // keep the in-memory copy
  }
}

const now = (): string => new Date().toISOString();

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const withoutMoves = (game: Game): Game => {
  const summary = { ...game };
  delete summary.moves;
  return summary;
};

function findGame(store: Store, id: number): Game {
  const game = store.games.find((g) => g.id === id);
  if (!game) throw new LocalGameError('Game not found');
  return game;
}

export function createGame(payload: CreateGamePayload): Game {
  const store = load();
  const stamp = now();
  const game: Game = {
    id: store.nextGameId,
    user_id: LOCAL_USER_ID,
    difficulty: payload.difficulty,
    board: newBoard(),
    human_score: 0,
    ai_score: 0,
    current_player: 'human',
    status: 'in_progress',
    created_at: stamp,
    updated_at: stamp,
    finished_at: null,
    moves: [],
  };
  store.nextGameId += 1;
  store.games.push(game);
  save(store);
  return clone(game);
}

export function listGames(params: GameListParams = {}): PaginatedGames {
  const page = params.page ?? 1;
  const pageSize = params.page_size ?? 20;
  const all = load()
    .games.filter((g) => !params.status || g.status === params.status)
    .sort((a, b) => b.id - a.id);
  const items = all.slice((page - 1) * pageSize, page * pageSize).map(withoutMoves);
  return { items: clone(items), total: all.length, page, page_size: pageSize };
}

export function getGame(id: number): Game {
  return clone(findGame(load(), id));
}

export function abandonGame(id: number): void {
  const store = load();
  const game = findGame(store, id);
  if (game.status !== 'in_progress') throw new LocalGameError('Game is not in progress');
  game.status = 'abandoned';
  game.finished_at = now();
  game.updated_at = game.finished_at;
  save(store);
}

function record(store: Store, game: Game, res: EngineMove, cup: number): Move {
  const moves = game.moves ?? [];
  const move: Move = {
    id: store.nextMoveId,
    game_id: game.id,
    move_number: moves.length + 1,
    player: res.player,
    cup_index: cup,
    seeds_sown: res.seedsSown,
    seeds_captured: res.seedsCaptured,
    board_after: [...res.board],
    created_at: now(),
  };
  store.nextMoveId += 1;
  game.moves = [...moves, move];
  game.board = [...res.board];
  game.human_score = res.humanScore;
  game.ai_score = res.aiScore;
  game.current_player = res.nextPlayer;
  game.updated_at = move.created_at;
  return move;
}

const isStalemate = (game: Game): boolean => {
  const recent = (game.moves ?? []).slice(-STALEMATE_MOVES);
  return recent.length === STALEMATE_MOVES && recent.every((m) => m.seeds_captured === 0);
};

function finalize(game: Game): SweepStep[] {
  const final = finalResult(game.board, game.human_score, game.ai_score);
  game.board = final.board;
  game.human_score = final.humanScore;
  game.ai_score = final.aiScore;
  const status: Record<string, GameStatus> = { human: 'human_won', ai: 'ai_won', draw: 'draw' };
  game.status = status[final.winner] as GameStatus;
  game.finished_at = now();
  game.updated_at = game.finished_at;
  return final.sweep;
}

const traceOf = (res: EngineMove): TraceStep[] => res.trace.map((s) => ({ ...s }));

/** Plays the human move and the AI's reply in one go, like POST /api/games/{id}/moves. */
export function playMove(id: number, payload: MovePayload): MoveResult {
  const store = load();
  const game = findGame(store, id);
  const cup = payload.cup_index;
  if (game.status !== 'in_progress') throw new LocalGameError('Game is not in progress');
  if (!Number.isInteger(cup) || cup < 0 || cup > 13) throw new LocalGameError('Cup index out of range');
  if (cup > 6) throw new LocalGameError("Cannot play the opponent's cup");
  if ((game.board[cup] ?? 0) <= 0) throw new LocalGameError('Cannot play an empty cup');

  const humanRes = applyMove(game.board, 'human', cup, game.human_score, game.ai_score);
  const humanMove = record(store, game, humanRes, cup);
  let aiMove: Move | null = null;
  let aiTrace: TraceStep[] = [];
  let sweep: SweepStep[] = [];
  let over = humanRes.isGameOver;

  if (!over) {
    const aiCup = chooseMove(game.board, game.difficulty as Difficulty);
    const aiRes = applyMove(game.board, 'ai', aiCup, game.human_score, game.ai_score);
    aiMove = record(store, game, aiRes, aiCup);
    aiTrace = traceOf(aiRes);
    over = aiRes.isGameOver;
  }
  if (!over && isStalemate(game)) over = true;
  if (over) sweep = finalize(game);

  save(store);
  return {
    game: clone(game),
    human_move: clone(humanMove),
    ai_move: aiMove ? clone(aiMove) : null,
    human_trace: traceOf(humanRes),
    ai_trace: aiTrace,
    sweep,
  };
}

const emptyRecord = () => ({ wins: 0, losses: 0, draws: 0 });

/** Same definitions as the backend: finished games only, avg captured excludes swept seeds. */
export function getStats(): Stats {
  const finished = load().games.filter((g) => ['human_won', 'ai_won', 'draw'].includes(g.status));
  const byDifficulty: Stats['by_difficulty'] = { easy: emptyRecord(), medium: emptyRecord() };
  let captured = 0;
  for (const g of finished) {
    const record_ = byDifficulty[g.difficulty];
    if (g.status === 'human_won') record_.wins += 1;
    else if (g.status === 'ai_won') record_.losses += 1;
    else record_.draws += 1;
    captured += (g.moves ?? [])
      .filter((m) => m.player === 'human')
      .reduce((n, m) => n + m.seeds_captured, 0);
  }

  const ordered = [...finished].sort(
    (a, b) => (a.finished_at ?? '').localeCompare(b.finished_at ?? '') || a.id - b.id,
  );
  let streak = 0;
  for (const g of ordered) streak = g.status === 'human_won' ? streak + 1 : 0;

  const count = finished.length;
  return {
    total_games: count,
    wins: byDifficulty.easy.wins + byDifficulty.medium.wins,
    losses: byDifficulty.easy.losses + byDifficulty.medium.losses,
    draws: byDifficulty.easy.draws + byDifficulty.medium.draws,
    by_difficulty: byDifficulty,
    avg_captured: count === 0 ? 0 : Math.round((captured / count) * 100) / 100,
    current_streak: streak,
  };
}

/** Test helper: wipe the stored games. */
export function resetLocalGames(): void {
  memory = { nextGameId: 1, nextMoveId: 1, games: [] };
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // nothing to clear
  }
}

export { validMoves };
