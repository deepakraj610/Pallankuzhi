/**
 * Pure Pallankuzhi game engine (TypeScript port of backend/app/services/game_engine.py).
 *
 * Board: 14 cups. Indexes 0-6 belong to the human, 7-13 to the AI. Sowing goes in increasing
 * index order, wrapping modulo 14. Invariant: sum(board) + humanScore + aiScore === TOTAL_SEEDS.
 * Every function is non-mutating.
 */
import type { Player, SweepStep, TraceStep } from '../types';

export type Board = number[];
export type Winner = Player | 'draw';

export const NUM_CUPS = 14;
export const SEEDS_PER_CUP = 5;
export const TOTAL_SEEDS = NUM_CUPS * SEEDS_PER_CUP;
export const MAX_RELAYS = 1000;
/**
 * House rule: after this many consecutive moves with no capture (half each) two players can be
 * chasing single seeds forever, so the game is declared a stalemate.
 */
export const STALEMATE_MOVES = 40;

export interface MoveResult {
  board: Board;
  humanScore: number;
  aiScore: number;
  seedsSown: number;
  seedsCaptured: number;
  player: Player;
  nextPlayer: Player;
  isGameOver: boolean;
  trace: TraceStep[];
}

export interface GameResult {
  board: Board;
  humanScore: number;
  aiScore: number;
  winner: Winner;
  sweep: SweepStep[];
}

export const opponent = (player: Player): Player => (player === 'human' ? 'ai' : 'human');

export const sideRange = (player: Player): number[] =>
  player === 'human' ? [0, 1, 2, 3, 4, 5, 6] : [7, 8, 9, 10, 11, 12, 13];

export const newBoard = (): Board => new Array<number>(NUM_CUPS).fill(SEEDS_PER_CUP);

/** Non-empty cups on the player's own side. */
export const validMoves = (board: Board, player: Player): number[] =>
  sideRange(player).filter((i) => (board[i] ?? 0) > 0);

/**
 * Picks up every seed in `cup` and sows one per cup (no cup skipped), so a big handful can lap
 * back into the origin. Returns the new board and the cup the last seed landed in. When `trace`
 * is given, the pickup and each drop are appended to it.
 */
export function sowSeeds(board: Board, cup: number, trace?: TraceStep[]): [Board, number] {
  const next = [...board];
  const seeds = next[cup] ?? 0;
  if (seeds <= 0) throw new Error(`cup ${cup} is empty`);
  next[cup] = 0;
  trace?.push({ kind: 'pickup', cup, count: seeds });
  let pos = cup;
  for (let i = 0; i < seeds; i += 1) {
    pos = (pos + 1) % NUM_CUPS;
    next[pos] = (next[pos] ?? 0) + 1;
    trace?.push({ kind: 'drop', cup: pos, count: 1 });
  }
  return [next, pos];
}

/**
 * Classic relay capture. After the last seed lands in `lastCup`: if the next cup is non-empty,
 * pick it up and keep sowing (relay). If it is empty, the player captures the cup after that (if
 * non-empty) and the turn ends. Relay pickups, drops and the capture are appended to `trace`.
 */
export function resolveCapture(
  board: Board,
  lastCup: number,
  trace?: TraceStep[],
): [Board, number] {
  let current = [...board];
  let pos = lastCup;
  for (let relay = 0; relay < MAX_RELAYS; relay += 1) {
    const nxt = (pos + 1) % NUM_CUPS;
    if ((current[nxt] ?? 0) === 0) {
      const target = (nxt + 1) % NUM_CUPS;
      const captured = current[target] ?? 0;
      current[target] = 0;
      if (captured > 0) trace?.push({ kind: 'capture', cup: target, count: captured });
      return [current, captured];
    }
    [current, pos] = sowSeeds(current, nxt, trace);
  }
  return [current, 0];
}

/** Over when no seeds remain, or the player to move has none on their side. */
export const isGameOver = (board: Board, nextPlayer: Player): boolean =>
  board.reduce((sum, n) => sum + n, 0) === 0 || validMoves(board, nextPlayer).length === 0;

/** Validates and applies a move. Throws for illegal moves. */
export function applyMove(
  board: Board,
  player: Player,
  cup: number,
  humanScore = 0,
  aiScore = 0,
): MoveResult {
  if (!validMoves(board, player).includes(cup)) {
    throw new Error(`illegal move: cup ${cup} for ${player}`);
  }
  const seedsSown = board[cup] ?? 0;
  const trace: TraceStep[] = [];
  const [sown, last] = sowSeeds(board, cup, trace);
  const [resultBoard, captured] = resolveCapture(sown, last, trace);
  const nextPlayer = opponent(player);
  return {
    board: resultBoard,
    humanScore: humanScore + (player === 'human' ? captured : 0),
    aiScore: aiScore + (player === 'ai' ? captured : 0),
    seedsSown,
    seedsCaptured: captured,
    player,
    nextPlayer,
    isGameOver: isGameOver(resultBoard, nextPlayer),
    trace,
  };
}

/** Sweeps each side's leftover seeds to its owner, then decides the winner. */
export function finalResult(board: Board, humanScore: number, aiScore: number): GameResult {
  const sweep: SweepStep[] = [];
  for (const owner of ['human', 'ai'] as const) {
    for (const cup of sideRange(owner)) {
      const count = board[cup] ?? 0;
      if (count > 0) sweep.push({ cup, count, owner });
    }
  }
  const human = humanScore + sweep.filter((s) => s.owner === 'human').reduce((n, s) => n + s.count, 0);
  const ai = aiScore + sweep.filter((s) => s.owner === 'ai').reduce((n, s) => n + s.count, 0);
  const winner: Winner = human > ai ? 'human' : ai > human ? 'ai' : 'draw';
  return { board: new Array<number>(NUM_CUPS).fill(0), humanScore: human, aiScore: ai, winner, sweep };
}
