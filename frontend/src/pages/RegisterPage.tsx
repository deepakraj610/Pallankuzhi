import { Box, Divider, Heading, Link, Text, VStack } from '@chakra-ui/react';
import { Link as RouterLink, Navigate } from 'react-router-dom';
import { GlassCard } from '../components/ui';
import { PageWrapper } from '../components/layout';
import { RegisterForm } from '../components/auth/RegisterForm';
import { GoogleLoginButton } from '../components/auth/GoogleLoginButton';
import { useAuth } from '../hooks/useAuth';

export default function RegisterPage() {
  const { user, isLoading } = useAuth();
  if (!isLoading && user) return <Navigate to="/dashboard" replace />;

  return (
    <PageWrapper>
      <GlassCard maxW="md" mx="auto" mt={16}>
        <VStack spacing={5} align="stretch">
          <Box textAlign="center">
            <Heading size="lg" mb={1}>Create your account</Heading>
            <Text color="gray.600">Join and start playing</Text>
          </Box>
          <RegisterForm />
          <Divider />
          <GoogleLoginButton />
          <Text textAlign="center" fontSize="sm">
            Already registered?{' '}
            <Link as={RouterLink} to="/login" color="purple.600" fontWeight="semibold">
              Sign in
            </Link>
          </Text>
        </VStack>
      </GlassCard>
    </PageWrapper>
  );
}
