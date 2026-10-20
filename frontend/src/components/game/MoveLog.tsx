import { Box, Heading, List, ListItem, Text } from '@chakra-ui/react';
import type { Move } from '../../types';

interface MoveLogProps {
  moves: Move[];
}

export function MoveLog({ moves }: MoveLogProps) {
  return (
    <Box>
      <Heading size="sm" mb={2}>Moves</Heading>
      {moves.length === 0 ? (
        <Text color="gray.500" fontSize="sm">No moves yet.</Text>
      ) : (
        <List spacing={1} maxH="280px" overflowY="auto" fontSize="sm">
          {[...moves].reverse().map((m) => (
            <ListItem key={`${m.player}-${m.move_number}-${m.id}`}>
              #{m.move_number} {m.player === 'human' ? 'You' : 'Opponent'}: cup {(m.cup_index % 7) + 1}, sowed {m.seeds_sown}
              {m.seeds_captured > 0 ? `, captured ${m.seeds_captured}` : ''}
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
}
