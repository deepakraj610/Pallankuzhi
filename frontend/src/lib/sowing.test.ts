import type { TraceStep } from '../types';
import { planFrames, planSweepFrames, stepTiming, sweepStepDuration } from './sowing';

const BOARD = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5];

describe('planFrames', () => {
  it('returns no frames for an empty trace', () => {
    expect(planFrames(BOARD, [], 'human')).toEqual([]);
  });

  it('empties the picked-up cup, then drops one seed at a time hopping from the previous seed', () => {
    const trace: TraceStep[] = [
      { kind: 'pickup', cup: 0, count: 3 },
      { kind: 'drop', cup: 1, count: 1 },
      { kind: 'drop', cup: 2, count: 1 },
      { kind: 'drop', cup: 3, count: 1 },
    ];
    const frames = planFrames(BOARD, trace, 'human');
    expect(frames.map((f) => f.kind)).toEqual(['pickup', 'drop', 'drop', 'drop']);
    expect(frames[0].board[0]).toBe(0);
    expect(frames[1]).toMatchObject({ from: 0, to: 1 });
    expect(frames[2]).toMatchObject({ from: 1, to: 2 });
    expect(frames[3].board.slice(0, 4)).toEqual([0, 6, 6, 6]);
  });

  it('sends a capture to the mover\'s trough and reports the seeds taken', () => {
    const trace: TraceStep[] = [{ kind: 'capture', cup: 9, count: 5 }];
    const human = planFrames(BOARD, trace, 'human')[0];
    expect(human).toMatchObject({ from: 9, to: 'human-trough', captured: 5 });
    expect(human.board[9]).toBe(0);
    expect(planFrames(BOARD, trace, 'ai')[0].to).toBe('ai-trough');
  });

  it('does not mutate the starting board', () => {
    const start = [...BOARD];
    planFrames(start, [{ kind: 'pickup', cup: 2, count: 5 }], 'human');
    expect(start).toEqual(BOARD);
  });

  it('keeps hopping from the last landing cup across a relay pickup', () => {
    const trace: TraceStep[] = [
      { kind: 'pickup', cup: 0, count: 1 },
      { kind: 'drop', cup: 1, count: 1 },
      { kind: 'pickup', cup: 2, count: 5 },
      { kind: 'drop', cup: 3, count: 1 },
    ];
    const frames = planFrames(BOARD, trace, 'human');
    expect(frames[3]).toMatchObject({ kind: 'drop', from: 2, to: 3 });
  });
});

describe('stepTiming', () => {
  const drops = (n: number) =>
    planFrames(BOARD, Array.from({ length: n }, () => ({ kind: 'drop', cup: 1, count: 1 }) as TraceStep), 'human');

  it('moves at a natural hand pace for ordinary moves', () => {
    const t = stepTiming(drops(13));
    expect(t.drop).toBe(450);
    expect(t.pickup).toBeGreaterThan(t.drop);
  });

  it('eases up only for very long relay chains, within bounds', () => {
    expect(stepTiming(drops(100)).drop).toBeLessThan(stepTiming(drops(13)).drop);
    expect(stepTiming(drops(500)).drop).toBe(200);
  });

  it('counts pickups and captures in the budget so relay-heavy moves stay bounded', () => {
    const relay: TraceStep[] = [];
    for (let i = 0; i < 20; i += 1) {
      relay.push({ kind: 'pickup', cup: i % 14, count: 3 }, { kind: 'drop', cup: 1, count: 1 }, { kind: 'drop', cup: 2, count: 1 });
    }
    relay.push({ kind: 'capture', cup: 4, count: 6 });
    const t = stepTiming(planFrames(BOARD, relay, 'human'));
    const total = t.drop * 40 + t.pickup * 20 + t.capture;
    expect(total).toBeLessThanOrEqual(21000);
    expect(t.capture).toBeGreaterThan(t.drop);
  });

  it('falls back to the natural pace with no frames', () => {
    expect(stepTiming([]).drop).toBe(450);
  });
});

describe('planSweepFrames', () => {
  const START = [0, 2, 0, 0, 3, 0, 0, 0, 0, 6, 0, 0, 0, 0];

  it('sends each leftover pile to its owner\'s trough, one frame per pile', () => {
    const frames = planSweepFrames(START, [
      { cup: 1, count: 2, owner: 'human' },
      { cup: 4, count: 3, owner: 'human' },
      { cup: 9, count: 6, owner: 'ai' },
    ]);
    expect(frames.map((f) => [f.cup, f.to, f.captured])).toEqual([
      [1, 'human-trough', 2],
      [4, 'human-trough', 3],
      [9, 'ai-trough', 6],
    ]);
    expect(frames[0].board[1]).toBe(0);
    expect(frames[2].board).toEqual(new Array(14).fill(0));
  });

  it('returns no frames when there is nothing to sweep', () => {
    expect(planSweepFrames(START, [])).toEqual([]);
  });

  it('does not mutate the starting board', () => {
    const copy = [...START];
    planSweepFrames(START, [{ cup: 1, count: 2, owner: 'human' }]);
    expect(START).toEqual(copy);
  });
});

describe('sweepStepDuration', () => {
  const frames = (n: number) =>
    planSweepFrames(
      new Array(14).fill(1),
      Array.from({ length: n }, (_, i) => ({ cup: i % 14, count: 1, owner: 'human' as const })),
    );

  it('is unhurried for a few piles and brisk for many, within bounds', () => {
    expect(sweepStepDuration(frames(2))).toBe(600);
    expect(sweepStepDuration(frames(30))).toBeLessThan(sweepStepDuration(frames(4)));
    expect(sweepStepDuration(frames(14))).toBeGreaterThanOrEqual(250);
    expect(sweepStepDuration([])).toBe(600);
  });
});
