import { chakra, Flex, Heading, Text } from '@chakra-ui/react';
import { motion } from 'framer-motion';
import type { Difficulty } from '../../types';

const MotionBox = motion.create(chakra.button);

interface DifficultyPickerProps {
  value: Difficulty;
  onChange: (d: Difficulty) => void;
}

const OPTIONS: { value: Difficulty; title: string; blurb: string }[] = [
  { value: 'easy', title: 'Easy', blurb: 'A relaxed opponent that plays randomly.' },
  { value: 'medium', title: 'Medium', blurb: 'A smarter opponent that looks for captures.' },
];

export function DifficultyPicker({ value, onChange }: DifficultyPickerProps) {
  return (
    <Flex gap={4} direction={{ base: 'column', md: 'row' }} role="radiogroup" aria-label="Difficulty">
      {OPTIONS.map((o) => (
        <MotionBox
          key={o.value}
              type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
          flex={1}
          p={5}
          rounded="xl"
          textAlign="left"
          border="2px solid"
          borderColor={value === o.value ? 'purple.500' : 'gray.200'}
          bg={value === o.value ? 'purple.50' : 'white'}
        >
          <Heading size="md">{o.title}</Heading>
          <Text fontSize="sm" color="gray.600">{o.blurb}</Text>
        </MotionBox>
      ))}
    </Flex>
  );
}
