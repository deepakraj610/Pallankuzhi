import { Box, Heading, SimpleGrid, Text } from '@chakra-ui/react';
import type { Difficulty, Stats } from '../../types';
import { GlassCard } from '../ui';

interface StatCardsProps {
  stats: Stats;
}

interface StatItem {
  label: string;
  value: string;
}

const DIFFICULTIES: Difficulty[] = ['easy', 'medium'];

function formatStreak(streak: number): string {
  if (streak > 0) return `${streak} win${streak === 1 ? '' : 's'}`;
  if (streak < 0) return `${-streak} loss${streak === -1 ? '' : 'es'}`;
  return '0';
}

export function StatCards({ stats }: StatCardsProps) {
  const decided = stats.wins + stats.losses + stats.draws;
  const winRate = decided > 0 ? Math.round((stats.wins / decided) * 100) : 0;

  const items: StatItem[] = [
    { label: 'Wins', value: String(stats.wins) },
    { label: 'Losses', value: String(stats.losses) },
    { label: 'Draws', value: String(stats.draws) },
    { label: 'Win rate', value: `${winRate}%` },
    { label: 'Streak', value: formatStreak(stats.current_streak) },
    { label: 'Avg seeds captured', value: stats.avg_captured.toFixed(1) },
  ];

  return (
    <Box>
      <SimpleGrid columns={{ base: 2, md: 3, lg: 6 }} spacing={4} mb={4}>
        {items.map((item) => (
          <GlassCard key={item.label} p={4}>
            <Text fontSize="sm" color="gray.600">{item.label}</Text>
            <Heading size="lg">{item.value}</Heading>
          </GlassCard>
        ))}
      </SimpleGrid>
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
        {DIFFICULTIES.map((d) => {
          const rec = stats.by_difficulty[d];
          return (
            <GlassCard key={d} p={4}>
              <Text fontWeight="semibold" textTransform="capitalize" mb={1}>{d}</Text>
              <Text color="gray.600">{`${rec.wins}W / ${rec.losses}L / ${rec.draws}D`}</Text>
            </GlassCard>
          );
        })}
      </SimpleGrid>
    </Box>
  );
}
