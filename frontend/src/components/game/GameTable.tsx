import { Badge, Button, Table, TableContainer, Tbody, Td, Th, Thead, Tr } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import type { Game, GameStatus } from '../../types';

const COLORS: Record<GameStatus, string> = {
  in_progress: 'blue',
  human_won: 'green',
  ai_won: 'red',
  draw: 'gray',
  abandoned: 'yellow',
};

interface GameTableProps {
  games: Game[];
}

export function GameTable({ games }: GameTableProps) {
  return (
    <TableContainer>
      <Table size="sm">
        <Thead>
          <Tr>
            <Th>Date</Th>
            <Th>Difficulty</Th>
            <Th>Status</Th>
            <Th isNumeric>Score</Th>
            <Th>Actions</Th>
          </Tr>
        </Thead>
        <Tbody>
          {games.map((g) => (
            <Tr key={g.id}>
              <Td>{new Date(g.created_at).toLocaleString()}</Td>
              <Td>{g.difficulty}</Td>
              <Td><Badge colorScheme={COLORS[g.status]}>{g.status.replace('_', ' ')}</Badge></Td>
              <Td isNumeric>{g.human_score} - {g.ai_score}</Td>
              <Td>
                <Button as={RouterLink} to={`/games/${g.id}`} size="xs" variant="outline">
                  {g.status === 'in_progress' ? 'Resume' : 'View'}
                </Button>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </TableContainer>
  );
}
