import { Button } from '@chakra-ui/react';
import { googleLoginUrl } from '../../services/authService';

export function GoogleLoginButton() {
  return (
    <Button as="a" href={googleLoginUrl} variant="outline" rounded="full" w="full" bg="white">
      Continue with Google
    </Button>
  );
}
