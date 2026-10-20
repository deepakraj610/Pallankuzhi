import { useId } from 'react';
import { Box } from '@chakra-ui/react';
import { motion, useReducedMotion } from 'framer-motion';

const MotionBox = motion.create(Box);

// Glass outline; the sand rectangles are clipped to this shape.
const GLASS = 'M5 2 H19 V6 C19 11 14 14 12 16 C14 18 19 21 19 26 V30 H5 V26 C5 21 10 18 12 16 C10 14 5 11 5 6 Z';

const CYCLE_S = 2.4;
// The sand runs for 80% of the cycle, then the glass flips for the remaining 20%.
const TIMES = [0, 0.8, 1];

interface HourglassProps {
  size?: number;
}

/** An hourglass that drains and flips, shown while the opponent is thinking. */
export function Hourglass({ size = 28 }: HourglassProps) {
  const clipId = `hourglass-${useId().replace(/:/g, '')}`;
  const reduceMotion = useReducedMotion() ?? false;
  const loop = { duration: CYCLE_S, times: TIMES, repeat: Infinity, ease: 'linear' as const };

  return (
    <MotionBox
      role="img"
      aria-label="Opponent is thinking"
      data-testid="hourglass"
      w={`${size}px`}
      h={`${(size * 32) / 24}px`}
      flexShrink={0}
      animate={reduceMotion ? undefined : { rotate: [0, 0, 180] }}
      transition={reduceMotion ? undefined : { ...loop, ease: ['linear', 'easeInOut'] }}
    >
      <svg viewBox="0 0 24 32" width="100%" height="100%" aria-hidden="true" focusable="false">
        <defs>
          <clipPath id={clipId}>
            <path d={GLASS} />
          </clipPath>
        </defs>
        <rect x={3} y={0} width={18} height={2.5} rx={1} fill="#8a3d1c" />
        <rect x={3} y={29.5} width={18} height={2.5} rx={1} fill="#8a3d1c" />
        <path d={GLASS} fill="rgba(255, 255, 255, 0.45)" stroke="#4a1d0c" strokeWidth={1.2} strokeLinejoin="round" />
        <g clipPath={`url(#${clipId})`}>
          {/* Sand in the upper bulb: its surface sinks toward the neck. */}
          <motion.rect
            x={0}
            width={24}
            fill="#d9a441"
            initial={{ y: 5, height: 11 }}
            animate={reduceMotion ? undefined : { y: [5, 16, 16], height: [11, 0, 0] }}
            transition={reduceMotion ? undefined : loop}
          />
          {/* Sand piling up in the lower bulb. */}
          <motion.rect
            x={0}
            width={24}
            fill="#d9a441"
            initial={{ y: 27, height: 3 }}
            animate={reduceMotion ? undefined : { y: [28, 20, 20], height: [2, 10, 10] }}
            transition={reduceMotion ? undefined : loop}
          />
          {/* The thin falling stream. */}
          {!reduceMotion && (
            <motion.rect
              x={11.4}
              y={16}
              width={1.2}
              height={12}
              fill="#d9a441"
              animate={{ opacity: [1, 1, 0] }}
              transition={loop}
            />
          )}
        </g>
      </svg>
    </MotionBox>
  );
}
