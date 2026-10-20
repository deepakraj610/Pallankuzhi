import { render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import { ProtectedRoute } from './ProtectedRoute';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
}

const auth = vi.hoisted(() => ({
  state: { user: null, isLoading: false } as AuthState,
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => auth.state,
}));

const user: User = {
  id: 1,
  email: 'a@b.c',
  full_name: 'Asha',
  is_active: true,
  is_verified: true,
  oauth_provider: null,
  created_at: '',
};

const renderRoute = () =>
  render(
    <ChakraProvider>
      <MemoryRouter initialEntries={['/secret']}>
        <Routes>
          <Route path="/login" element={<div>login page</div>} />
          <Route
            path="/secret"
            element={
              <ProtectedRoute>
                <div>secret content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    </ChakraProvider>,
  );

describe('ProtectedRoute', () => {
  it('redirects anonymous users to /login', () => {
    auth.state = { user: null, isLoading: false };
    renderRoute();
    expect(screen.getByText('login page')).toBeInTheDocument();
    expect(screen.queryByText('secret content')).not.toBeInTheDocument();
  });

  it('renders children for authenticated users', () => {
    auth.state = { user, isLoading: false };
    renderRoute();
    expect(screen.getByText('secret content')).toBeInTheDocument();
  });

  it('shows a spinner and neither page while loading', () => {
    auth.state = { user: null, isLoading: true };
    renderRoute();
    expect(screen.queryByText('login page')).not.toBeInTheDocument();
    expect(screen.queryByText('secret content')).not.toBeInTheDocument();
  });
});
