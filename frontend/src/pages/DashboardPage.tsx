import { Alert, AlertIcon, Box, Button, Container, Heading, Skeleton, Stack } from '@chakra-ui/react';
import { PageWrapper } from '../components/layout';
import { StatCards } from '../components/dashboard/StatCards';
import { ResumeGameCard } from '../components/dashboard/ResumeGameCard';
import { RecentGames } from '../components/dashboard/RecentGames';
import { useAuth } from '../context/AuthContext';
import { useStats } from '../hooks/useStats';

export default function DashboardPage() {
  const { user } = useAuth();
  const { stats, resumeGame, recentGames, isLoading, error, reload } = useStats();
  const name = user?.full_name ?? user?.email ?? 'player';

  return (
    <PageWrapper>
      <Container maxW="5xl" py={10}>
        <Heading mb={6}>{`Welcome back, ${name}`}</Heading>
        {isLoading ? (
          <Stack spacing={4} data-testid="dashboard-loading">
            <Skeleton h="80px" rounded="2xl" />
            <Skeleton h="120px" rounded="2xl" />
            <Skeleton h="160px" rounded="2xl" />
          </Stack>
        ) : error ? (
          <Alert status="error" rounded="xl">
            <AlertIcon />
            <Box flex="1">{error}</Box>
            <Button size="sm" onClick={reload}>Retry</Button>
          </Alert>
        ) : (
          <Stack spacing={8}>
            {stats && <StatCards stats={stats} />}
            <ResumeGameCard game={resumeGame} />
            <RecentGames games={recentGames} />
          </Stack>
        )}
      </Container>
    </PageWrapper>
  );
}
