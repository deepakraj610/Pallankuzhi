import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { LoginForm } from './LoginForm';

const loginMock = vi.fn<(email: string, password: string) => Promise<void>>();

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ login: loginMock }),
}));

const setup = () =>
  render(
    <ChakraProvider>
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    </ChakraProvider>,
  );

describe('LoginForm', () => {
  beforeEach(() => {
    loginMock.mockReset();
  });

  it('shows validation errors and does not submit empty form', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });

  it('submits credentials', async () => {
    loginMock.mockResolvedValue();
    setup();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(loginMock).toHaveBeenCalledWith('a@b.com', 'secret123'));
  });

  it('shows server error', async () => {
    const failure = Object.assign(new Error('401'), {
      response: { data: { detail: 'Incorrect email or password' } },
    });
    loginMock.mockImplementation(() => {
      const p = Promise.reject(failure);
      p.catch(() => undefined);
      return p;
    });
    setup();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'bad' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(screen.getByText('Incorrect email or password')).toBeInTheDocument());
  });
});
