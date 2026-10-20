import { useLayoutEffect, useRef, useState } from 'react';
import { Box, Flex, Grid } from '@chakra-ui/react';
import { motion } from 'framer-motion';
import type { Endpoint } from '../../lib/sowing';
import { Cup } from './Cup';
import { Seed, SeedDefs } from './Seed';
import { Trough } from './Trough';

const MotionBox = motion.create(Box);
const FLIGHT_SIZE = 22;

export interface FlightState {
  id: number;
  from: Endpoint;
  to: Endpoint;
  ms: number;
}

interface FlightPath {
  id: number;
  ms: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const selectorFor = (e: Endpoint): string =>
  typeof e === 'number' ? `[data-cup="${e}"]` : `[data-trough="${e === 'human-trough' ? 'human' : 'ai'}"]`;

interface BoardProps {
  board: number[];
  disabled: boolean;
  humanScore?: number;
  aiScore?: number;
  lastIndex?: number | null;
  flight?: FlightState | null;
  onSelect: (cupIndex: number) => void;
}

// Portrait board, counter-clockwise sowing: up the human (right) column from the bottom,
// then down the opponent (left) column from the top.
const AI_COLUMN = [7, 8, 9, 10, 11, 12, 13];
const HUMAN_COLUMN = [6, 5, 4, 3, 2, 1, 0];

const CORNERS = [
  { top: 2, left: 2 },
  { top: 2, right: 2 },
  { bottom: 2, left: 2 },
  { bottom: 2, right: 2 },
] as const;

export function Board({
  board,
  disabled,
  humanScore = 0,
  aiScore = 0,
  lastIndex = null,
  flight = null,
  onSelect,
}: BoardProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [path, setPath] = useState<FlightPath | null>(null);

  // Measure the pits after layout so the flying seed travels between their real positions.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!flight || !root) {
      setPath(null);
      return;
    }
    const rootRect = root.getBoundingClientRect();
    const origin = { x: rootRect.left + root.clientLeft, y: rootRect.top + root.clientTop };
    const centre = (e: Endpoint): { x: number; y: number } | null => {
      const el = root.querySelector(selectorFor(e));
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2 - origin.x, y: r.top + r.height / 2 - origin.y };
    };
    const a = centre(flight.from);
    const b = centre(flight.to);
    setPath(a && b ? { id: flight.id, ms: flight.ms, x0: a.x, y0: a.y, x1: b.x, y1: b.y } : null);
  }, [flight]);

  return (
    <Box
      ref={rootRef}
      position="relative"
      w={{
        base: 'clamp(220px, calc((100vh - 240px) / 2.2), min(92vw, 320px))',
        md: 'clamp(240px, calc((100vh - 240px) / 2.2), 380px)',
      }}
      p={{ base: 4, md: 6 }}
      rounded="2xl"
      bgGradient="linear(to-br, #7a2316, #4a130a 55%, #5e1a0f)"
      border="10px solid"
      borderColor="#2e0b05"
      boxShadow="0 18px 40px rgba(46, 11, 5, 0.55), inset 0 0 0 2px #8a3d1c, inset 0 0 28px rgba(0, 0, 0, 0.55)"
      role="group"
      aria-label="Game board"
    >
      {path && (
        <MotionBox
          key={path.id}
          position="absolute"
          top={0}
          left={0}
          w={`${FLIGHT_SIZE}px`}
          h={`${FLIGHT_SIZE}px`}
          zIndex={2}
          pointerEvents="none"
          initial={{ x: path.x0 - FLIGHT_SIZE / 2, y: path.y0 - FLIGHT_SIZE / 2, scale: 1.2 }}
          animate={{
            x: [path.x0, (path.x0 + path.x1) / 2, path.x1].map((v) => v - FLIGHT_SIZE / 2),
            y: [path.y0, Math.min(path.y0, path.y1) - 16, path.y1].map((v) => v - FLIGHT_SIZE / 2),
            scale: [1.2, 1.6, 1],
          }}
          transition={{ duration: path.ms / 1000, ease: 'easeInOut' }}
          data-testid="flying-seed"
        >
          <svg viewBox={`0 0 ${FLIGHT_SIZE} ${FLIGHT_SIZE}`} width="100%" height="100%" aria-hidden="true" focusable="false">
            <SeedDefs id="flying-seed-gradient" />
            <Seed
              placement={{ x: FLIGHT_SIZE / 2, y: FLIGHT_SIZE / 2, rotation: 35, length: 18 }}
              gradientId="flying-seed-gradient"
            />
          </svg>
        </MotionBox>
      )}
      {CORNERS.map((pos, i) => (
        <Box
          key={i}
          position="absolute"
          w="10px"
          h="10px"
          bg="#c99a3c"
          transform="rotate(45deg)"
          opacity={0.85}
          {...pos}
        />
      ))}
      <Box
        border="2px dotted"
        borderColor="rgba(201, 154, 60, 0.45)"
        rounded="xl"
        p={{ base: 2, md: 3 }}
      >
        <Grid templateColumns="1fr 0.5fr 1fr" gap={{ base: 2, md: 3 }} alignItems="stretch">
          <Flex direction="column" gap={{ base: 1.5, md: 2 }} data-testid="ai-column">
            {AI_COLUMN.map((i) => (
              <Cup
                key={i}
                index={i}
                seeds={board[i] ?? 0}
                owner="ai"
                clickable={false}
                highlighted={lastIndex === i}
                onSelect={onSelect}
              />
            ))}
          </Flex>
          <Flex direction="column" justify="space-between" gap={{ base: 3, md: 4 }} py={1}>
            <Box data-trough="ai"><Trough seeds={aiScore} label="Opponent" /></Box>
            <Box data-trough="human"><Trough seeds={humanScore} label="You" /></Box>
          </Flex>
          <Flex direction="column" gap={{ base: 1.5, md: 2 }} data-testid="human-column">
            {HUMAN_COLUMN.map((i) => (
              <Cup
                key={i}
                index={i}
                seeds={board[i] ?? 0}
                owner="human"
                clickable={!disabled}
                highlighted={lastIndex === i}
                onSelect={onSelect}
              />
            ))}
          </Flex>
        </Grid>
      </Box>
    </Box>
  );
}
