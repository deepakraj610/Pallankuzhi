import { useCallback, useEffect, useRef, useState } from 'react';
import { abandonGame, extractError, getGame, playMove } from '../services/gameService';
import {
  planFrames,
  planSweepFrames,
  stepTiming,
  sweepStepDuration,
  type SowFrame,
} from '../lib/sowing';
import type { FlightState } from '../components/game/Board';
import type { Difficulty, Game, Move, SweepStep, TraceStep } from '../types';

export type PlayPhase = 'idle' | 'you' | 'thinking' | 'opponent';

// How long the opponent "thinks" before it picks up a cup; the harder AI takes a little longer.
const THINK_MS: Record<Difficulty, number> = { easy: 1200, medium: 2000 };
// Beat between the last move landing and the final sweep.
const SWEEP_LEAD_IN_MS = 900;

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface UseGameResult {
  game: Game | null;
  board: number[];
  humanScore: number;
  aiScore: number;
  moves: Move[];
  lastIndex: number | null;
  flight: FlightState | null;
  phase: PlayPhase;
  loading: boolean;
  busy: boolean;
  error: string | null;
  isHumanTurn: boolean;
  play: (cupIndex: number) => Promise<void>;
  abandon: () => Promise<void>;
}

export function useGame(gameId: number): UseGameResult {
  const [game, setGame] = useState<Game | null>(null);
  const [board, setBoard] = useState<number[]>([]);
  const [humanScore, setHumanScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [moves, setMoves] = useState<Move[]>([]);
  const [lastIndex, setLastIndex] = useState<number | null>(null);
  const [flight, setFlight] = useState<FlightState | null>(null);
  const [phase, setPhase] = useState<PlayPhase>('idle');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wake = useRef<(() => void) | null>(null);
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const flightId = useRef(0);
  const boardRef = useRef<number[]>([]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      // Resolve any pending delay so play() can finish without touching state.
      wake.current?.();
      wake.current = null;
    };
  }, []);

  const apply = useCallback((g: Game): void => {
    setGame(g);
    setBoard(g.board);
    boardRef.current = g.board;
    setHumanScore(g.human_score);
    setAiScore(g.ai_score);
    setMoves(g.moves ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getGame(gameId)
      .then((g) => {
        if (!cancelled) apply(g);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(extractError(err, 'Could not load game'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [gameId, apply]);

  const sleep = useCallback((ms: number): Promise<void> => {
    return new Promise<void>((resolve) => {
      wake.current = resolve;
      timer.current = setTimeout(() => {
        wake.current = null;
        resolve();
      }, ms);
    });
  }, []);

  // Plays frames in order: each hop/capture flies a seed, then the board lands on the frame's state.
  const playFrames = useCallback(
    async (frames: SowFrame[], timing: { drop: number; pickup: number; capture: number }): Promise<void> => {
      for (const frame of frames) {
        if (!mounted.current) return;
        setLastIndex(frame.cup);
        if (frame.kind === 'pickup') {
          setBoard(frame.board);
          await sleep(timing.pickup);
          continue;
        }
        const ms = frame.kind === 'capture' ? timing.capture : timing.drop;
        if (frame.from !== null && frame.to !== null) {
          flightId.current += 1;
          setFlight({ id: flightId.current, from: frame.from, to: frame.to, ms });
        }
        await sleep(ms);
        if (!mounted.current) return;
        setBoard(frame.board);
        if (frame.captured > 0) {
          const setScore = frame.to === 'human-trough' ? setHumanScore : setAiScore;
          setScore((prev) => prev + frame.captured);
        }
      }
      setFlight(null);
    },
    [sleep],
  );

  // One move's sowing: lift the seeds, hop one seed per pit, then sweep captures to the trough.
  const animateMove = useCallback(
    async (trace: TraceStep[], start: number[], mover: 'human' | 'ai'): Promise<void> => {
      const frames = prefersReducedMotion() ? [] : planFrames(start, trace, mover);
      await playFrames(frames, stepTiming(frames));
    },
    [playFrames],
  );

  // End of game: leftover piles slide into their owners' troughs.
  const animateSweep = useCallback(
    async (sweep: SweepStep[], start: number[]): Promise<void> => {
      if (sweep.length === 0 || prefersReducedMotion()) return;
      await sleep(SWEEP_LEAD_IN_MS);
      if (!mounted.current) return;
      const frames = planSweepFrames(start, sweep);
      const ms = sweepStepDuration(frames);
      await playFrames(frames, { drop: ms, pickup: ms, capture: ms });
    },
    [playFrames, sleep],
  );

  const play = useCallback(
    async (cupIndex: number): Promise<void> => {
      if (inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      setPhase('you');
      setError(null);
      try {
        const res = await playMove(gameId, { cup_index: cupIndex });
        const { game: next, human_move: hm, ai_move: am } = res;
        if (!mounted.current) return;
        const humanTrace = res.human_trace ?? [];
        const aiTrace = res.ai_trace ?? [];

        // Human sowing. With no trace (or reduced motion) fall back to snapping to the result.
        setMoves((prev) => [...prev, hm]);
        if (humanTrace.length > 0) {
          await animateMove(humanTrace, boardRef.current, 'human');
          if (!mounted.current) return;
        } else {
          setHumanScore((prev) => prev + hm.seeds_captured);
        }
        setBoard(hm.board_after);
        boardRef.current = hm.board_after;
        setLastIndex(hm.cup_index);
        setFlight(null);

        if (am) {
          setPhase('thinking');
          await sleep(THINK_MS[next.difficulty]);
          if (!mounted.current) return;
          setPhase('opponent');
          setMoves((prev) => [...prev, am]);
          if (aiTrace.length > 0) {
            await animateMove(aiTrace, boardRef.current, 'ai');
            if (!mounted.current) return;
          } else {
            setAiScore((prev) => prev + am.seeds_captured);
          }
          setBoard(am.board_after);
          boardRef.current = am.board_after;
          setLastIndex(am.cup_index);
          setFlight(null);
        }
        await animateSweep(res.sweep ?? [], boardRef.current);
        if (!mounted.current) return;
        // Final server state (includes the end-of-game sweep when the game ended).
        setBoard(next.board);
        boardRef.current = next.board;
        setHumanScore(next.human_score);
        setAiScore(next.ai_score);
        setGame(next);
      } catch (err: unknown) {
        if (!mounted.current) return;
        setFlight(null);
        setError(extractError(err, 'Move failed'));
        try {
          const fresh = await getGame(gameId);
          if (mounted.current) apply(fresh);
        } catch {
          // keep current state
        }
      } finally {
        inFlight.current = false;
        if (mounted.current) {
          setBusy(false);
          setPhase('idle');
        }
      }
    },
    [gameId, apply, animateMove, animateSweep, sleep],
  );

  const abandon = useCallback(async (): Promise<void> => {
    try {
      await abandonGame(gameId);
      apply(await getGame(gameId));
    } catch (err: unknown) {
      setError(extractError(err, 'Could not abandon game'));
    }
  }, [gameId, apply]);

  return {
    game,
    board,
    humanScore,
    aiScore,
    moves,
    lastIndex,
    flight,
    phase,
    loading,
    busy,
    error,
    isHumanTurn: game?.status === 'in_progress' && game.current_player === 'human',
    play,
    abandon,
  };
}
