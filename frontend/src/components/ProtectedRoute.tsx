import { Center, Spinner } from '@chakra-ui/react';
import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <Center minH="100vh">
        <Spinner color="purple.500" />
      </Center>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
