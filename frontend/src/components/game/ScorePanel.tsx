import { Badge, Flex, Stat, StatLabel, StatNumber, Text } from '@chakra-ui/react';
import type { Difficulty } from '../../types';
import { Hourglass } from './Hourglass';

interface ScorePanelProps {
  humanScore: number;
  aiScore: number;
  difficulty: Difficulty;
  statusText: string;
  thinking?: boolean;
}

export function ScorePanel({ humanScore, aiScore, difficulty, statusText, thinking = false }: ScorePanelProps) {
  return (
    <Flex justify="space-between" align="center" gap={4} wrap="wrap">
      <Stat>
        <StatLabel>You</StatLabel>
        <StatNumber data-testid="human-score">{humanScore}</StatNumber>
      </Stat>
      <Flex direction="column" align="center" gap={1}>
        <Badge colorScheme={difficulty === 'easy' ? 'green' : 'orange'}>{difficulty}</Badge>
        <Flex align="center" gap={2} minH="38px">
          {thinking && <Hourglass />}
          <Text fontSize="sm" color="gray.600" aria-live="polite">{statusText}</Text>
        </Flex>
      </Flex>
      <Stat textAlign="right">
        <StatLabel>Opponent</StatLabel>
        <StatNumber data-testid="ai-score">{aiScore}</StatNumber>
      </Stat>
    </Flex>
  );
}
