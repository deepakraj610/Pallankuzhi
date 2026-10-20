import { Heading, Text } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import type { Game } from '../../types';
import { GlassCard, GradientButton } from '../ui';

interface ResumeGameCardProps {
  game: Game | null;
}

export function ResumeGameCard({ game }: ResumeGameCardProps) {
  if (!game) {
    return (
      <GlassCard>
        <Heading size="md" mb={2}>Ready to play?</Heading>
        <Text color="gray.600" mb={4}>Start a new game of Pallankuzhi.</Text>
        <GradientButton as={RouterLink} {...{ to: "/games/new" }}>New game</GradientButton>
      </GlassCard>
    );
  }
  return (
    <GlassCard>
      <Heading size="md" mb={2}>Game in progress</Heading>
      <Text color="gray.600" mb={4} textTransform="capitalize">
        {`${game.difficulty} - You ${game.human_score} : ${game.ai_score} AI`}
      </Text>
      <GradientButton as={RouterLink} {...{ to: `/games/${game.id}` }}>Resume game</GradientButton>
    </GlassCard>
  );
}
