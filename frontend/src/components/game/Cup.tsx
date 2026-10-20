import { useId } from 'react';
import { chakra } from '@chakra-ui/react';
import { motion } from 'framer-motion';
import { pitLayout } from '../../lib/seedLayout';
import { Seed, SeedDefs } from './Seed';

const MotionButton = motion.create(chakra.button);
const MotionGroup = motion.g;

export type CupOwner = 'human' | 'ai';

interface CupProps {
  index: number;
  seeds: number;
  owner: CupOwner;
  clickable: boolean;
  highlighted?: boolean;
  onSelect: (index: number) => void;
}

export function Cup({ index, seeds, owner, clickable, highlighted = false, onSelect }: CupProps) {
  const uid = useId().replace(/:/g, '');
  const seedGradient = `seed-${uid}`;
  const pitGradient = `pit-${uid}`;
  const number = (index % 7) + 1;
  const label = `${owner === 'human' ? 'Your' : 'Opponent'} cup ${number}, ${seeds} ${seeds === 1 ? 'seed' : 'seeds'}`;
  const enabled = clickable && seeds > 0;
  const placements = pitLayout(seeds);

  const rimColor = highlighted ? '#ffd27a' : enabled ? '#d9a441' : '#2b0d07';
  const rimWidth = highlighted ? 4 : enabled ? 2.5 : 1;

  return (
    <MotionButton
      type="button"
      aria-label={label}
      title={label}
      data-cup={index}
      disabled={!enabled}
      onClick={() => onSelect(index)}
      whileHover={enabled ? { scale: 1.06 } : undefined}
      whileTap={enabled ? { scale: 0.95 } : undefined}
      w="100%"
      aspectRatio={1}
      p={0}
      bg="transparent"
      rounded="full"
      cursor={enabled ? 'pointer' : 'default'}
      display="block"
      _focusVisible={{ outline: '3px solid', outlineColor: 'yellow.300', outlineOffset: '2px' }}
    >
      <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id={pitGradient} cx="50%" cy="40%" r="65%">
            <stop offset="0%" stopColor="#8b3b22" />
            <stop offset="70%" stopColor="#5a1f10" />
            <stop offset="100%" stopColor="#2f0e06" />
          </radialGradient>
        </defs>
        <SeedDefs id={seedGradient} />
        <circle cx={50} cy={50} r={47} fill="#2b0d07" />
        <circle cx={50} cy={50} r={43} fill={`url(#${pitGradient})`} stroke={rimColor} strokeWidth={rimWidth} />
        <MotionGroup key={seeds} initial={{ opacity: 0.35 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
          {placements.map((p, i) => (
            <Seed key={i} placement={p} gradientId={seedGradient} />
          ))}
        </MotionGroup>
      </svg>
    </MotionButton>
  );
}
