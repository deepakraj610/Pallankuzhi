import { useState } from 'react';
import { Alert, AlertIcon, Box, Button, Flex, Spinner, Stack } from '@chakra-ui/react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageWrapper } from '../components/layout';
import { Board } from '../components/game/Board';
import { ScorePanel } from '../components/game/ScorePanel';
import { MoveLog } from '../components/game/MoveLog';
import { GameOverModal } from '../components/game/GameOverModal';
import { useGame } from '../hooks/useGame';

export default function GamePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const g = useGame(Number(id));
  const [modalDismissed, setModalDismissed] = useState(false);

  if (g.loading) {
    return (
      <PageWrapper>
        <Flex justify="center" mt={24}><Spinner size="xl" /></Flex>
      </PageWrapper>
    );
  }

  if (!g.game) {
    return (
      <PageWrapper>
        <Box maxW="lg" mx="auto" mt={16} px={4}>
          <Alert status="error" rounded="md"><AlertIcon />{g.error ?? 'Game not found'}</Alert>
        </Box>
      </PageWrapper>
    );
  }

  const status = g.game.status;
  const inProgress = status === 'in_progress';
  const statusText = !inProgress
    ? 'Game over'
    : g.phase === 'you'
      ? 'Your move...'
      : g.phase === 'thinking'
        ? 'Opponent is thinking...'
        : g.busy || !g.isHumanTurn
          ? 'Opponent is playing...'
          : 'Your turn';

  return (
    <PageWrapper>
      <Flex maxW="5xl" mx="auto" mt={8} px={4} gap={6} direction={{ base: 'column', lg: 'row' }} align={{ lg: 'flex-start' }}>
        <Box p={6} rounded="2xl" bg="whiteAlpha.600" border="1px solid" borderColor="whiteAlpha.700" shadow="xl" flexShrink={0}>
          <Stack spacing={5} align="center">
            <Box w="100%">
              <ScorePanel humanScore={g.humanScore} aiScore={g.aiScore} difficulty={g.game.difficulty} statusText={statusText} thinking={inProgress && g.phase === 'thinking'} />
            </Box>
            <Board
              board={g.board}
              disabled={g.busy || !g.isHumanTurn}
              humanScore={g.humanScore}
              aiScore={g.aiScore}
              lastIndex={g.lastIndex}
              flight={g.flight}
              onSelect={(i) => void g.play(i)}
            />
            {g.error && <Alert status="error" rounded="md"><AlertIcon />{g.error}</Alert>}
            <Flex gap={3}>
              {inProgress && (
                <Button colorScheme="red" variant="outline" onClick={() => void g.abandon()} isDisabled={g.busy}>
                  Abandon game
                </Button>
              )}
              <Button variant="ghost" onClick={() => navigate('/games')}>All games</Button>
            </Flex>
          </Stack>
        </Box>
        <Box flex="1" w="100%" p={6} rounded="2xl" bg="whiteAlpha.600" border="1px solid" borderColor="whiteAlpha.700" shadow="xl">
          <MoveLog moves={g.moves} />
        </Box>
      </Flex>
      <GameOverModal
        status={modalDismissed ? 'in_progress' : status}
        humanScore={g.humanScore}
        aiScore={g.aiScore}
        onPlayAgain={() => navigate('/games/new')}
        onClose={() => setModalDismissed(true)}
      />
    </PageWrapper>
  );
}
