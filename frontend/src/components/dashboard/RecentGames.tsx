import { Box, Flex, Heading, Link, Text } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import type { Game, GameStatus } from '../../types';
import { AnimatedList, GlassCard } from '../ui';

interface RecentGamesProps {
  games: Game[];
}

const STATUS_LABEL: Record<GameStatus, string> = {
  in_progress: 'In progress',
  human_won: 'Won',
  ai_won: 'Lost',
  draw: 'Draw',
  abandoned: 'Abandoned',
};

export function RecentGames({ games }: RecentGamesProps) {
  return (
    <Box>
      <Flex justify="space-between" align="center" mb={3}>
        <Heading size="md">Recent games</Heading>
        <Link as={RouterLink} to="/games" color="purple.600" fontWeight="semibold">View all</Link>
      </Flex>
      {games.length === 0 ? (
        <Text color="gray.600">No games yet. Play your first game!</Text>
      ) : (
        <AnimatedList>
          {games.map((g) => (
            <Link key={g.id} as={RouterLink} to={`/games/${g.id}`} _hover={{ textDecoration: 'none' }}>
              <GlassCard p={4} mb={3}>
                <Flex justify="space-between" align="center">
                  <Text textTransform="capitalize">{`${g.difficulty} - ${g.human_score} : ${g.ai_score}`}</Text>
                  <Text fontWeight="semibold">{STATUS_LABEL[g.status]}</Text>
                </Flex>
              </GlassCard>
            </Link>
          ))}
        </AnimatedList>
      )}
    </Box>
  );
}
