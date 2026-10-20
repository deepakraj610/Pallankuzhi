/** AI opponent (port of backend/app/services/ai_opponent.py): easy = random, medium = greedy. */
import type { Difficulty, Player } from '../types';
import { applyMove, opponent, validMoves, type Board } from './engine';

export type Rng = () => number;

const pick = <T>(items: readonly T[], rng: Rng): T => items[Math.floor(rng() * items.length)] as T;

const bestReplyCapture = (board: Board, player: Player): number =>
  Math.max(0, ...validMoves(board, player).map((m) => applyMove(board, player, m).seedsCaptured));

/**
 * Picks a cup for `player` (default the AI). Easy plays a random legal cup. Medium takes the
 * biggest immediate capture, breaking ties by leaving the opponent the smallest best reply, then
 * at random. Throws when there are no legal moves.
 */
export function chooseMove(
  board: Board,
  difficulty: Difficulty,
  rng: Rng = Math.random,
  player: Player = 'ai',
): number {
  const moves = validMoves(board, player);
  if (moves.length === 0) throw new Error('no valid moves');
  if (difficulty === 'easy') return pick(moves, rng);

  const scored = moves.map((move) => {
    const res = applyMove(board, player, move);
    const reply = res.isGameOver ? 0 : bestReplyCapture(res.board, opponent(player));
    return { move, capture: res.seedsCaptured, reply };
  });
  const best = scored.reduce(
    (top, s) =>
      s.capture > top.capture || (s.capture === top.capture && s.reply < top.reply) ? s : top,
    scored[0] as (typeof scored)[number],
  );
  return pick(
    scored.filter((s) => s.capture === best.capture && s.reply === best.reply).map((s) => s.move),
    rng,
  );
}
