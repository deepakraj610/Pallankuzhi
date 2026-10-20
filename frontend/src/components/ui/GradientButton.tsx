import { Button } from '@chakra-ui/react';
import type { ButtonProps } from '@chakra-ui/react';
import { motion } from 'framer-motion';

const MotionButton = motion.create(Button);

type GradientButtonProps = Omit<ButtonProps, 'transition' | 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart'>;

export function GradientButton({ children, ...props }: GradientButtonProps) {
  return (
    <MotionButton
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      px={6}
      py={3}
      rounded="full"
      fontWeight="semibold"
      color="white"
      bgGradient="linear(to-r, purple.500, pink.500)"
      _hover={{ shadow: 'lg', bgGradient: 'linear(to-r, purple.600, pink.600)' }}
      {...props}
    >
      {children}
    </MotionButton>
  );
}
