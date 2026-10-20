import { pitLayout, troughLayout } from './seedLayout';

describe('pitLayout', () => {
  it('returns no seeds for an empty pit', () => {
    expect(pitLayout(0)).toEqual([]);
  });

  it('centres a single seed', () => {
    const [seed] = pitLayout(1);
    expect(seed).toMatchObject({ x: 50, y: 50 });
  });

  it.each([2, 5, 12, 30, 60])('keeps %i seeds inside the pit and shrinks them as it fills', (count) => {
    const seeds = pitLayout(count);
    expect(seeds).toHaveLength(count);
    seeds.forEach((s) => {
      expect(Math.hypot(s.x - 50, s.y - 50) + s.length / 2).toBeLessThanOrEqual(41);
    });
    expect(seeds[0].length).toBeLessThanOrEqual(22);
  });

  it('uses smaller seeds for a fuller pit', () => {
    expect(pitLayout(40)[0].length).toBeLessThan(pitLayout(4)[0].length);
  });

  it('is deterministic', () => {
    expect(pitLayout(17)).toEqual(pitLayout(17));
  });
});

describe('troughLayout', () => {
  it('returns no seeds for an empty trough', () => {
    expect(troughLayout(0, 60, 150)).toEqual([]);
  });

  it.each([1, 10, 35, 70])('keeps %i captured seeds inside the trough', (count) => {
    const seeds = troughLayout(count, 60, 150);
    expect(seeds).toHaveLength(count);
    seeds.forEach((s) => {
      expect(s.x).toBeGreaterThan(0);
      expect(s.x).toBeLessThan(60);
      expect(s.y).toBeGreaterThan(0);
      expect(s.y).toBeLessThan(150);
    });
  });
});
