import type { SweepStep, TraceStep } from '../types';

export type Endpoint = number | 'human-trough' | 'ai-trough';

export interface SowFrame {
  kind: TraceStep['kind'];
  /** Cup the step happens at. */
  cup: number;
  /** Board once the step has landed. */
  board: number[];
  /** A seed travels from -> to before the board updates (drops and captures only). */
  from: Endpoint | null;
  to: Endpoint | null;
  /** Seeds added to the mover's captured pile by this frame. */
  captured: number;
}

/**
 * Turns a server trace into display frames. Each drop hops from where the previous seed
 * landed (the picked-up cup for the first one); a capture sends the cup to the mover's trough.
 */
export function planFrames(
  start: number[],
  trace: readonly TraceStep[],
  mover: 'human' | 'ai',
): SowFrame[] {
  const board = [...start];
  const frames: SowFrame[] = [];
  let hand: number | null = null;

  for (const step of trace) {
    if (step.kind === 'pickup') {
      board[step.cup] = 0;
      hand = step.cup;
      frames.push({ kind: 'pickup', cup: step.cup, board: [...board], from: null, to: null, captured: 0 });
    } else if (step.kind === 'drop') {
      board[step.cup] = (board[step.cup] ?? 0) + 1;
      frames.push({ kind: 'drop', cup: step.cup, board: [...board], from: hand, to: step.cup, captured: 0 });
      hand = step.cup;
    } else {
      board[step.cup] = 0;
      frames.push({
        kind: 'capture',
        cup: step.cup,
        board: [...board],
        from: step.cup,
        to: mover === 'human' ? 'human-trough' : 'ai-trough',
        captured: step.count,
      });
    }
  }
  return frames;
}

// Natural pace, like moving seeds by hand: about half a second per seed. Only very long relay
// chains are sped up, so a single move never drags past ~14s.
const TOTAL_BUDGET_MS = 14000;
const MIN_STEP_MS = 200;
const MAX_STEP_MS = 450;

/** A lifted handful or a capture holds the board a little longer than one dropped seed. */
const PICKUP_WEIGHT = 1.3;
const CAPTURE_WEIGHT = 2;

export interface Timing {
  /** Duration of one seed hop. */
  drop: number;
  /** Pause while a handful is lifted (initial pickup and relays). */
  pickup: number;
  /** Duration of the seeds sweeping into the trough. */
  capture: number;
}

/** Per-move timing: a hand-like pace, eased up only for very long relay chains. */
export function stepTiming(frames: readonly SowFrame[]): Timing {
  const count = (kind: SowFrame['kind']) => frames.filter((f) => f.kind === kind).length;
  const weight = count('drop') + count('pickup') * PICKUP_WEIGHT + count('capture') * CAPTURE_WEIGHT;
  const drop =
    weight === 0 ? MAX_STEP_MS : Math.max(MIN_STEP_MS, Math.min(MAX_STEP_MS, Math.round(TOTAL_BUDGET_MS / weight)));
  return { drop, pickup: Math.round(drop * PICKUP_WEIGHT), capture: Math.round(drop * CAPTURE_WEIGHT) };
}

/** End of game: every leftover pile slides into its owner's trough, one pile at a time. */
export function planSweepFrames(start: number[], sweep: readonly SweepStep[]): SowFrame[] {
  const board = [...start];
  return sweep.map((step) => {
    board[step.cup] = 0;
    return {
      kind: 'capture',
      cup: step.cup,
      board: [...board],
      from: step.cup,
      to: step.owner === 'human' ? 'human-trough' : 'ai-trough',
      captured: step.count,
    };
  });
}

const SWEEP_BUDGET_MS = 8000;
const MIN_SWEEP_MS = 250;
const MAX_SWEEP_MS = 600;

/** Duration of one pile's trip to the trough: unhurried, eased up only when many piles remain. */
export function sweepStepDuration(frames: readonly SowFrame[]): number {
  if (frames.length === 0) return MAX_SWEEP_MS;
  return Math.max(MIN_SWEEP_MS, Math.min(MAX_SWEEP_MS, Math.round(SWEEP_BUDGET_MS / frames.length)));
}
