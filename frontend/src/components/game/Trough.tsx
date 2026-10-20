import { useId } from 'react';
import { troughLayout } from '../../lib/seedLayout';
import { Seed, SeedDefs } from './Seed';

const WIDTH = 60;
const HEIGHT = 150;

interface TroughProps {
  seeds: number;
  label: string;
}

/** The carved centre trough that holds one player's captured seeds. */
export function Trough({ seeds, label }: TroughProps) {
  const uid = useId().replace(/:/g, '');
  const seedGradient = `seed-${uid}`;
  const woodGradient = `trough-${uid}`;
  const text = `${label}: ${seeds} ${seeds === 1 ? 'seed' : 'seeds'} captured`;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width="100%"
      role="img"
      aria-label={text}
      data-testid={`trough-${label.toLowerCase()}`}
    >
      <title>{text}</title>
      <defs>
        <linearGradient id={woodGradient} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2f0e06" />
          <stop offset="50%" stopColor="#6b2615" />
          <stop offset="100%" stopColor="#2f0e06" />
        </linearGradient>
      </defs>
      <SeedDefs id={seedGradient} />
      <rect x={1} y={1} width={WIDTH - 2} height={HEIGHT - 2} rx={29} fill="#2b0d07" />
      <rect x={4} y={4} width={WIDTH - 8} height={HEIGHT - 8} rx={26} fill={`url(#${woodGradient})`} stroke="#8a3d1c" strokeWidth={1} />
      {troughLayout(seeds, WIDTH, HEIGHT).map((p, i) => (
        <Seed key={i} placement={p} gradientId={seedGradient} />
      ))}
    </svg>
  );
}
