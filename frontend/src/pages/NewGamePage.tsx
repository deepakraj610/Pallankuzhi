import { useState } from 'react';
import { Alert, AlertIcon, Heading, Stack } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { GlassCard, GradientButton } from '../components/ui';
import { PageWrapper } from '../components/layout';
import { DifficultyPicker } from '../components/game/DifficultyPicker';
import { createGame, extractError } from '../services/gameService';
import type { Difficulty } from '../types';

export default function NewGamePage() {
  const navigate = useNavigate();
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const game = await createGame({ difficulty });
      navigate(`/games/${game.id}`);
    } catch (err: unknown) {
      setError(extractError(err, 'Could not start game'));
      setLoading(false);
    }
  };

  return (
    <PageWrapper>
      <GlassCard maxW="2xl" mx="auto" mt={16}>
        <Stack spacing={6}>
          <Heading size="lg">New game</Heading>
          <DifficultyPicker value={difficulty} onChange={setDifficulty} />
          {error && (
            <Alert status="error" rounded="md"><AlertIcon />{error}</Alert>
          )}
          <GradientButton onClick={() => void start()} isLoading={loading}>Start game</GradientButton>
        </Stack>
      </GlassCard>
    </PageWrapper>
  );
}
