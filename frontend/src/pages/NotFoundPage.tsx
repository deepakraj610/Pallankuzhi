import { Heading, Text } from '@chakra-ui/react';
import { GlassCard } from '../components/ui';
import { PageWrapper } from '../components/layout';

export default function NotFoundPage() {
  return (
    <PageWrapper>
      <GlassCard maxW="lg" mx="auto" mt={16}>
        <Heading size="lg" mb={2}>Not Found</Heading>
        <Text color="gray.600">Coming soon: 404</Text>
      </GlassCard>
    </PageWrapper>
  );
}
