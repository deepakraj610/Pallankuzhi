import { Badge, Heading, HStack, Text, VStack } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { GlassCard, GradientButton } from '../components/ui';
import { PageWrapper } from '../components/layout';
import { useAuth } from '../hooks/useAuth';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  if (!user) return null;

  return (
    <PageWrapper>
      <GlassCard maxW="lg" mx="auto" mt={16}>
        <VStack spacing={4} align="stretch">
          <Heading size="lg">{user.full_name ?? 'Player'}</Heading>
          <Text color="gray.600">{user.email}</Text>
          <HStack>
            <Badge colorScheme={user.is_verified ? 'green' : 'yellow'}>
              {user.is_verified ? 'Verified' : 'Unverified'}
            </Badge>
            <Badge colorScheme="purple">{user.oauth_provider ?? 'email'}</Badge>
          </HStack>
          <Text fontSize="sm" color="gray.500">
            Member since {new Date(user.created_at).toLocaleDateString()}
          </Text>
          <GradientButton onClick={handleLogout}>Log out</GradientButton>
        </VStack>
      </GlassCard>
    </PageWrapper>
  );
}
