import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, ModalOverlay, Text } from '@chakra-ui/react';
import { GradientButton } from '../ui';
import type { GameStatus } from '../../types';

interface GameOverModalProps {
  status: GameStatus;
  humanScore: number;
  aiScore: number;
  onPlayAgain: () => void;
  onClose: () => void;
}

const TITLES: Record<GameStatus, string> = {
  in_progress: '',
  human_won: 'You won!',
  ai_won: 'You lost',
  draw: 'It is a draw',
  abandoned: 'Game abandoned',
};

export function GameOverModal({ status, humanScore, aiScore, onPlayAgain, onClose }: GameOverModalProps) {
  return (
    <Modal isOpen={status !== 'in_progress'} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{TITLES[status]}</ModalHeader>
        <ModalBody>
          <Text>Final score: You {humanScore} - Opponent {aiScore}</Text>
        </ModalBody>
        <ModalFooter gap={3}>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <GradientButton onClick={onPlayAgain}>Play again</GradientButton>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
