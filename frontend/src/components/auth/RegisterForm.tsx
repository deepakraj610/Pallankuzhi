import { useState } from 'react';
import type { FormEvent } from 'react';
import { Alert, AlertIcon, FormControl, FormErrorMessage, FormLabel, Input, VStack } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { GradientButton } from '../ui';
import { useAuth } from '../../hooks/useAuth';
import { getErrorMessage } from '../../services/authService';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface RegisterErrors {
  fullName?: string;
  email?: string;
  password?: string;
  confirm?: string;
}

export function RegisterForm() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validate = (): RegisterErrors => {
    const next: RegisterErrors = {};
    if (!fullName.trim()) next.fullName = 'Name is required';
    if (!EMAIL_RE.test(email)) next.email = 'Enter a valid email address';
    if (password.length < 8) next.password = 'Password must be at least 8 characters';
    if (confirm !== password) next.confirm = 'Passwords do not match';
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
      await register({ email, password, full_name: fullName.trim() });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setServerError(getErrorMessage(err, 'Registration failed. Please try again.'));
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
        <FormControl isInvalid={!!errors.fullName}>
          <FormLabel>Full name</FormLabel>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
          <FormErrorMessage>{errors.fullName}</FormErrorMessage>
        </FormControl>
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
            autoComplete="new-password"
          />
          <FormErrorMessage>{errors.password}</FormErrorMessage>
        </FormControl>
        <FormControl isInvalid={!!errors.confirm}>
          <FormLabel>Confirm password</FormLabel>
          <Input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
          <FormErrorMessage>{errors.confirm}</FormErrorMessage>
        </FormControl>
        <GradientButton type="submit" w="full" isLoading={loading} loadingText="Creating account">
          Create account
        </GradientButton>
      </VStack>
    </form>
  );
}
