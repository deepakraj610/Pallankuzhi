import { Box } from '@chakra-ui/react';
import type { BoxProps } from '@chakra-ui/react';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

const MotionBox = motion.create(Box);

interface GlassCardProps extends Omit<BoxProps, 'transition' | 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart'> {
  children: ReactNode;
}

export function GlassCard({ children, ...props }: GlassCardProps) {
  return (
    <MotionBox
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -5 }}
      p={6}
      rounded="2xl"
      bg="whiteAlpha.600"
      backdropFilter="blur(16px)"
      border="1px solid"
      borderColor="whiteAlpha.700"
      shadow="xl"
      {...props}
    >
      {children}
    </MotionBox>
  );
}
