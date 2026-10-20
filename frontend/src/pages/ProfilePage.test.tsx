import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import ProfilePage from './ProfilePage';
import type { User } from '../types';

const auth = vi.hoisted(() => ({
  logout: vi.fn(),
  user: null as User | null,
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: auth.user, logout: auth.logout }),
}));

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: 1,
  email: 'asha@example.com',
  full_name: 'Asha',
  is_active: true,
  is_verified: true,
  oauth_provider: null,
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

const renderPage = () =>
  render(
    <ChakraProvider>
      <MemoryRouter initialEntries={['/profile']}>
        <Routes>
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/login" element={<div>login page</div>} />
        </Routes>
      </MemoryRouter>
    </ChakraProvider>,
  );

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    auth.logout.mockResolvedValue(undefined);
    auth.user = makeUser();
  });

  it('shows profile details', () => {
    renderPage();
    expect(screen.getByText('Asha')).toBeInTheDocument();
    expect(screen.getByText('asha@example.com')).toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.getByText('email')).toBeInTheDocument();
  });

  it('shows fallbacks for unverified google users without a name', () => {
    auth.user = makeUser({ full_name: null, is_verified: false, oauth_provider: 'google' });
    renderPage();
    expect(screen.getByText('Player')).toBeInTheDocument();
    expect(screen.getByText('Unverified')).toBeInTheDocument();
    expect(screen.getByText('google')).toBeInTheDocument();
  });

  it('logs out and navigates to /login', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    await waitFor(() => {
      expect(auth.logout).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText('login page')).toBeInTheDocument();
  });

  it('renders nothing without a user', () => {
    auth.user = null;
    renderPage();
    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument();
  });
});
