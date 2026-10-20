import type { SeedPlacement } from '../../lib/seedLayout';

interface SeedDefsProps {
  id: string;
}

/** Gradient used by every seed in the surrounding <svg>; `id` must be unique per svg. */
export function SeedDefs({ id }: SeedDefsProps) {
  return (
    <defs>
      <radialGradient id={id} cx="35%" cy="30%" r="80%">
        <stop offset="0%" stopColor="#c0703f" />
        <stop offset="45%" stopColor="#8a3d1c" />
        <stop offset="100%" stopColor="#4a1d0c" />
      </radialGradient>
    </defs>
  );
}

interface SeedProps {
  placement: SeedPlacement;
  gradientId: string;
}

/** A single glossy tamarind seed: a flattened, slightly squarish oval with a highlight. */
export function Seed({ placement, gradientId }: SeedProps) {
  const { x, y, rotation, length } = placement;
  const rx = length / 2;
  const ry = rx * 0.72;
  return (
    <g transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${rotation})`}>
      <ellipse rx={rx} ry={ry} fill={`url(#${gradientId})`} stroke="#2a0f06" strokeWidth={0.9} />
      <ellipse cx={-rx * 0.25} cy={-ry * 0.35} rx={rx * 0.38} ry={ry * 0.25} fill="#f1c9a0" opacity={0.55} />
    </g>
  );
}
