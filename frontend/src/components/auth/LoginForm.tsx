import { useState } from 'react';
import type { FormEvent } from 'react';
import { Alert, AlertIcon, FormControl, FormErrorMessage, FormLabel, Input, VStack } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { GradientButton } from '../ui';
import { useAuth } from '../../hooks/useAuth';
import { getErrorMessage } from '../../services/authService';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface LoginErrors {
  email?: string;
  password?: string;
}

export function LoginForm() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<LoginErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validate = (): LoginErrors => {
    const next: LoginErrors = {};
    if (!EMAIL_RE.test(email)) next.email = 'Enter a valid email address';
    if (!password) next.password = 'Password is required';
    return next;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setServerError(null);
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setServerError(getErrorMessage(err, 'Login failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <VStack spacing={4}>
        {serverError && (
          <Alert status="error" rounded="lg">
            <AlertIcon />
            {serverError}
          </Alert>
        )}
        <FormControl isInvalid={!!errors.email}>
          <FormLabel>Email</FormLabel>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <FormErrorMessage>{errors.email}</FormErrorMessage>
        </FormControl>
        <FormControl isInvalid={!!errors.password}>
          <FormLabel>Password</FormLabel>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <FormErrorMessage>{errors.password}</FormErrorMessage>
        </FormControl>
        <GradientButton type="submit" w="full" isLoading={loading} loadingText="Signing in">
          Sign in
        </GradientButton>
      </VStack>
    </form>
  );
}
