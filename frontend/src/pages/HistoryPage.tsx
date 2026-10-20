import { useEffect, useState } from 'react';
import { Alert, AlertIcon, Button, Flex, Heading, Select, Spinner, Stack, Text } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { GlassCard } from '../components/ui';
import { PageWrapper } from '../components/layout';
import { GameTable } from '../components/game/GameTable';
import { extractError, listGames } from '../services/gameService';
import type { GameStatus, PaginatedGames } from '../types';

const PAGE_SIZE = 10;
const STATUSES: GameStatus[] = ['in_progress', 'human_won', 'ai_won', 'draw', 'abandoned'];

export default function HistoryPage() {
  const [status, setStatus] = useState<GameStatus | ''>('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaginatedGames | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listGames({ page, page_size: PAGE_SIZE, status: status || undefined })
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(extractError(err, 'Could not load games'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, status]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <PageWrapper>
      <GlassCard maxW="5xl" mx="auto" mt={12}>
        <Stack spacing={5}>
          <Flex justify="space-between" align="center" wrap="wrap" gap={3}>
            <Heading size="lg">Game history</Heading>
            <Flex gap={3}>
              <Select
                aria-label="Filter by status"
                w="auto"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as GameStatus | '');
                  setPage(1);
                }}
              >
                <option value="">All</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </Select>
              <Button as={RouterLink} to="/games/new" colorScheme="purple">New game</Button>
            </Flex>
          </Flex>
          {error && <Alert status="error" rounded="md"><AlertIcon />{error}</Alert>}
          {loading && <Spinner />}
          {!loading && data && data.items.length === 0 && <Text color="gray.600">No games found.</Text>}
          {data && data.items.length > 0 && <GameTable games={data.items} />}
          <Flex justify="space-between" align="center">
            <Button onClick={() => setPage((p) => p - 1)} isDisabled={page <= 1}>Previous</Button>
            <Text>Page {page} of {totalPages}</Text>
            <Button onClick={() => setPage((p) => p + 1)} isDisabled={page >= totalPages}>Next</Button>
          </Flex>
        </Stack>
      </GlassCard>
    </PageWrapper>
  );
}
