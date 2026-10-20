import { render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { GradientButton } from './GradientButton';

describe('GradientButton', () => {
  it('renders its label', () => {
    render(
      <ChakraProvider>
        <GradientButton>Play</GradientButton>
      </ChakraProvider>,
    );
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });
});
