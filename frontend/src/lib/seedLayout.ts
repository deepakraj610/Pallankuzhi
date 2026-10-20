export interface SeedPlacement {
  x: number;
  y: number;
  rotation: number;
  length: number;
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const MAX_SEED_LENGTH = 22;
const PIT_RADIUS = 40;
const PIT_MARGIN = 4;

// Deterministic pseudo-random tilt so a pile looks natural but never jitters between renders.
const tilt = (i: number): number => (i * 47) % 180;

/** Packs `count` tamarind seeds into a round pit drawn in a 100x100 viewBox. */
export function pitLayout(count: number): SeedPlacement[] {
  if (count <= 0) return [];
  if (count === 1) return [{ x: 50, y: 50, rotation: 25, length: MAX_SEED_LENGTH }];

  let length = MAX_SEED_LENGTH;
  let reach = PIT_RADIUS - length / 2 - PIT_MARGIN;
  for (let pass = 0; pass < 3; pass += 1) {
    const spacing = (1.77 * reach) / Math.sqrt(count);
    length = Math.min(MAX_SEED_LENGTH, 1.35 * spacing);
    reach = PIT_RADIUS - length / 2 - PIT_MARGIN;
  }

  return Array.from({ length: count }, (_, i) => {
    const radius = reach * Math.sqrt((i + 0.5) / count);
    const angle = i * GOLDEN_ANGLE;
    return {
      x: 50 + radius * Math.cos(angle),
      y: 50 + radius * Math.sin(angle),
      rotation: tilt(i),
      length,
    };
  });
}

/** Packs captured seeds into a trough drawn in a width x height viewBox (row-major grid). */
export function troughLayout(count: number, width: number, height: number): SeedPlacement[] {
  if (count <= 0) return [];
  const padding = 7;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const maxLength = 16;

  let length = maxLength;
  let cols = Math.max(1, Math.floor(innerW / length));
  let rows = Math.ceil(count / cols);
  while (rows * length * 0.8 > innerH && length > 4) {
    length -= 0.5;
    cols = Math.max(1, Math.floor(innerW / length));
    rows = Math.ceil(count / cols);
  }

  const cellW = innerW / cols;
  const cellH = Math.min(length * 0.8, innerH / rows);
  return Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    // Offset every other row so the seeds nest like a real pile.
    const offset = row % 2 === 0 ? 0 : cellW / 3;
    return {
      x: padding + cellW * (col + 0.5) + offset - cellW / 6,
      y: height - padding - cellH * (row + 0.5),
      rotation: tilt(i),
      length,
    };
  });
}
