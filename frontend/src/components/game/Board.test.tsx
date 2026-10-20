import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { ChakraProvider } from '@chakra-ui/react';
import { Board } from './Board';
import { Cup } from './Cup';

const BOARD = [4, 0, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4];

const wrap = (ui: ReactElement) => render(<ChakraProvider>{ui}</ChakraProvider>);

describe('Cup', () => {
  it('labels itself and calls onSelect when enabled', () => {
    const onSelect = vi.fn();
    wrap(<Cup index={2} seeds={4} owner="human" clickable onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'Your cup 3, 4 seeds' }));
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it('is disabled when empty', () => {
    wrap(<Cup index={1} seeds={0} owner="human" clickable onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Your cup 2, 0 seeds' })).toBeDisabled();
  });
});

describe('Board', () => {
  it('renders 14 cups and enables only non-empty human cups', () => {
    const onSelect = vi.fn();
    wrap(<Board board={BOARD} disabled={false} onSelect={onSelect} />);
    expect(screen.getAllByRole('button')).toHaveLength(14);
    expect(screen.getByRole('button', { name: 'Your cup 1, 4 seeds' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Your cup 2, 0 seeds' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Opponent cup 1, 4 seeds' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Your cup 1, 4 seeds' }));
    expect(onSelect).toHaveBeenCalledWith(0);
  });

  it('disables all cups when disabled', () => {
    wrap(<Board board={BOARD} disabled onSelect={vi.fn()} />);
    screen.getAllByRole('button').forEach((b) => expect(b).toBeDisabled());
  });
});
