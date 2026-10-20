import parity from './__fixtures__/parity.json';
import { chooseMove } from './ai';
import {
  applyMove,
  finalResult,
  newBoard,
  resolveCapture,
  sowSeeds,
  TOTAL_SEEDS,
  validMoves,
  type Board,
} from './engine';
import type { Player, TraceStep } from '../types';

interface MoveCase {
  board: Board;
  player: Player;
  cup: number;
  humanScore: number;
  aiScore: number;
  expected: {
    board: Board;
    humanScore: number;
    aiScore: number;
    seedsSown: number;
    seedsCaptured: number;
    nextPlayer: Player;
    isGameOver: boolean;
    trace: [TraceStep['kind'], number, number][];
  };
}

interface FinalCase {
  board: Board;
  humanScore: number;
  aiScore: number;
  expected: {
    humanScore: number;
    aiScore: number;
    winner: string;
    sweep: [number, number, Player][];
  };
}

const { moves, finals } = parity as unknown as { moves: MoveCase[]; finals: FinalCase[] };

// Seeded generator so the random playouts are reproducible.
const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

describe('parity with the Python engine', () => {
  it('replays every recorded move identically (board, scores, trace)', () => {
    expect(moves.length).toBeGreaterThan(400);
    for (const c of moves) {
      const res = applyMove(c.board, c.player, c.cup, c.humanScore, c.aiScore);
      expect(res.board).toEqual(c.expected.board);
      expect(res.humanScore).toBe(c.expected.humanScore);
      expect(res.aiScore).toBe(c.expected.aiScore);
      expect(res.seedsSown).toBe(c.expected.seedsSown);
      expect(res.seedsCaptured).toBe(c.expected.seedsCaptured);
      expect(res.nextPlayer).toBe(c.expected.nextPlayer);
      expect(res.isGameOver).toBe(c.expected.isGameOver);
      expect(res.trace.map((s) => [s.kind, s.cup, s.count])).toEqual(c.expected.trace);
    }
  });

  it('produces the same end-of-game sweep and winner', () => {
    expect(finals.length).toBeGreaterThan(20);
    for (const c of finals) {
      const res = finalResult(c.board, c.humanScore, c.aiScore);
      expect(res.humanScore).toBe(c.expected.humanScore);
      expect(res.aiScore).toBe(c.expected.aiScore);
      expect(res.winner).toBe(c.expected.winner);
      expect(res.sweep.map((s) => [s.cup, s.count, s.owner])).toEqual(c.expected.sweep);
      expect(res.board).toEqual(new Array(14).fill(0));
    }
  });
});

describe('engine rules', () => {
  it('starts with 5 seeds in all 14 cups', () => {
    expect(newBoard()).toEqual(new Array(14).fill(5));
  });

  it('sows around the board, lapping into the origin cup', () => {
    const board = new Array<number>(14).fill(0);
    board[13] = 15;
    const [after, last] = sowSeeds(board, 13);
    expect(last).toBe(0);
    expect(after[13]).toBe(1);
    expect(after[0]).toBe(2); // the 15th seed laps back to cup 0
    expect(after.slice(1, 13).every((n) => n === 1)).toBe(true);
    expect(after.reduce((n, x) => n + x, 0)).toBe(15);
  });

  it('relays through a full next cup, then captures after an empty cup', () => {
    const board = new Array<number>(14).fill(0);
    board[1] = 2; // relay cup: picked up and sown to 2 and 3
    board[3] = 4; // the second sow lands here, but the cup after is empty ...
    board[5] = 9; // ... so the cup beyond the empty one is captured
    const trace: TraceStep[] = [];
    const [after, captured] = resolveCapture(board, 0, trace);
    expect(captured).toBe(9);
    expect(after[5]).toBe(0);
    expect(trace[trace.length - 1]).toEqual({ kind: 'capture', cup: 5, count: 9 });
    expect(trace.some((s) => s.kind === 'pickup' && s.cup === 1)).toBe(true);
  });

  it('rejects illegal moves and never mutates its input', () => {
    const board = newBoard();
    const copy = [...board];
    expect(() => applyMove(board, 'human', 9)).toThrow();
    applyMove(board, 'human', 2);
    expect(board).toEqual(copy);
  });

  it('conserves 70 seeds and always terminates, under random play', () => {
    const rng = seeded(11);
    for (let game = 0; game < 120; game += 1) {
      let board = newBoard();
      let human = 0;
      let ai = 0;
      let player: Player = 'human';
      for (let turn = 0; turn < 5000; turn += 1) {
        const options = validMoves(board, player);
        const cup = options[Math.floor(rng() * options.length)] as number;
        const res = applyMove(board, player, cup, human, ai);
        board = res.board;
        human = res.humanScore;
        ai = res.aiScore;
        expect(board.reduce((n, x) => n + x, 0) + human + ai).toBe(TOTAL_SEEDS);
        if (res.isGameOver) break;
        player = res.nextPlayer;
        expect(turn).toBeLessThan(4999);
      }
    }
  });
});

describe('AI opponent', () => {
  it('easy only plays legal cups', () => {
    const rng = seeded(3);
    const board = newBoard();
    board[8] = 0;
    for (let i = 0; i < 50; i += 1) {
      expect(validMoves(board, 'ai')).toContain(chooseMove(board, 'easy', rng));
    }
  });

  it('medium takes the biggest capture available', () => {
    const board = new Array<number>(14).fill(0);
    board[7] = 1; // lands in 8, 9 empty -> captures cup 10? (cup 9 empty, target 10)
    board[10] = 7;
    board[11] = 1; // lands in 12, cup 13 empty -> target 0 (empty) -> nothing
    board[0] = 0;
    const scoreFor = (cup: number) => applyMove(board, 'ai', cup).seedsCaptured;
    const best = Math.max(...validMoves(board, 'ai').map(scoreFor));
    expect(scoreFor(chooseMove(board, 'medium', seeded(5)))).toBe(best);
  });

  it('throws when there is nothing to play', () => {
    expect(() => chooseMove(new Array(14).fill(0), 'easy')).toThrow();
  });

  it('medium beats easy clearly over many seeded games', () => {
    const rng = seeded(99);
    let mediumWins = 0;
    let easyWins = 0;
    for (let game = 0; game < 40; game += 1) {
      const mediumIsHuman = game % 2 === 0;
      let board = newBoard();
      let human = 0;
      let ai = 0;
      let player: Player = 'human';
      for (let turn = 0; turn < 400; turn += 1) {
        const isMedium = (player === 'human') === mediumIsHuman;
        const cup = chooseMove(board, isMedium ? 'medium' : 'easy', rng, player);
        const res = applyMove(board, player, cup, human, ai);
        board = res.board;
        human = res.humanScore;
        ai = res.aiScore;
        if (res.isGameOver) break;
        player = res.nextPlayer;
      }
      const final = finalResult(board, human, ai);
      const mediumScore = mediumIsHuman ? final.humanScore : final.aiScore;
      const easyScore = mediumIsHuman ? final.aiScore : final.humanScore;
      if (mediumScore > easyScore) mediumWins += 1;
      else if (easyScore > mediumScore) easyWins += 1;
    }
    expect(mediumWins).toBeGreaterThan(easyWins);
  });
});
