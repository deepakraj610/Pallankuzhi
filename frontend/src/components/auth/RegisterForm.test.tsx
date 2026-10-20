import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import type { RegisterPayload } from '../../types';
import { RegisterForm } from './RegisterForm';

const registerMock = vi.fn<(payload: RegisterPayload) => Promise<void>>();

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ register: registerMock }),
}));

const setup = () =>
  render(
    <ChakraProvider>
      <MemoryRouter>
        <RegisterForm />
      </MemoryRouter>
    </ChakraProvider>,
  );

const fill = (password: string, confirm: string) => {
  fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Asha' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'asha@x.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: confirm } });
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
};

describe('RegisterForm', () => {
  beforeEach(() => {
    registerMock.mockReset();
  });

  it('validates required fields', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('rejects mismatched passwords', async () => {
    setup();
    fill('password123', 'different1');
    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('submits valid data', async () => {
    registerMock.mockResolvedValue();
    setup();
    fill('password123', 'password123');
    await waitFor(() =>
      expect(registerMock).toHaveBeenCalledWith({
        email: 'asha@x.com',
        password: 'password123',
        full_name: 'Asha',
      }),
    );
  });
});
