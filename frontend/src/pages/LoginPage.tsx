import { useEffect } from 'react';
import { Box, Divider, Heading, Link, Text, VStack, useToast } from '@chakra-ui/react';
import { Link as RouterLink, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { GlassCard } from '../components/ui';
import { PageWrapper } from '../components/layout';
import { LoginForm } from '../components/auth/LoginForm';
import { GoogleLoginButton } from '../components/auth/GoogleLoginButton';
import { useAuth } from '../hooks/useAuth';

const OAUTH_ERRORS: Record<string, string> = {
  oauth_cancelled: 'Sign-in was cancelled.',
  oauth_failed: 'Google could not sign you in. Please try again.',
};

export default function LoginPage() {
  const { user, isLoading, loginWithTokens } = useAuth();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const oauthError = params.get('error');

  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const accessToken = fragment.get('access_token');
    const refreshToken = fragment.get('refresh_token');
    if (accessToken && refreshToken) {
      window.history.replaceState(null, '', window.location.pathname);
      loginWithTokens(accessToken, refreshToken)
        .then(() => navigate('/dashboard', { replace: true }))
        .catch(() => toast({ title: 'Google sign-in failed', status: 'error', isClosable: true }));
    } else if (oauthError) {
      setParams({}, { replace: true });
      const description = OAUTH_ERRORS[oauthError];
      if (description) {
        toast({ title: 'Google sign-in failed', description, status: 'error', isClosable: true });
      }
    }
  }, [oauthError, loginWithTokens, navigate, setParams, toast]);

  if (!isLoading && user) return <Navigate to="/dashboard" replace />;

  return (
    <PageWrapper>
      <GlassCard maxW="md" mx="auto" mt={16}>
        <VStack spacing={5} align="stretch">
          <Box textAlign="center">
            <Heading size="lg" mb={1}>Welcome back</Heading>
            <Text color="gray.600">Sign in to play Pallankuzhi</Text>
          </Box>
          <LoginForm />
          <Divider />
          <GoogleLoginButton />
          <Text textAlign="center" fontSize="sm">
            New here?{' '}
            <Link as={RouterLink} to="/register" color="purple.600" fontWeight="semibold">
              Create an account
            </Link>
          </Text>
        </VStack>
      </GlassCard>
    </PageWrapper>
  );
}
