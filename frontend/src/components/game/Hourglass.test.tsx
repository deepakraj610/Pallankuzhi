import { render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { Hourglass } from './Hourglass';

describe('Hourglass', () => {
  it('is exposed to assistive tech as the opponent thinking', () => {
    render(
      <ChakraProvider>
        <Hourglass />
      </ChakraProvider>,
    );
    expect(screen.getByRole('img', { name: 'Opponent is thinking' })).toBeInTheDocument();
  });

  it('gives each hourglass its own clip path so several can coexist', () => {
    const { container } = render(
      <ChakraProvider>
        <Hourglass />
        <Hourglass />
      </ChakraProvider>,
    );
    const ids = [...container.querySelectorAll('clipPath')].map((c) => c.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });
});
