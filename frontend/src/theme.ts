import { extendTheme, type ThemeConfig } from '@chakra-ui/react';

const config: ThemeConfig = { initialColorMode: 'light', useSystemColorMode: false };

export const theme = extendTheme({
  config,
  colors: {
    brand: {
      50: '#fdf2f8',
      100: '#fce7f3',
      200: '#fbcfe8',
      300: '#f9a8d4',
      400: '#f472b6',
      500: '#a855f7',
      600: '#9333ea',
      700: '#7e22ce',
      800: '#6b21a8',
      900: '#581c87',
    },
  },
  fonts: {
    heading: "'Inter', system-ui, sans-serif",
    body: "'Inter', system-ui, sans-serif",
  },
  styles: {
    global: { body: { bg: 'purple.50', color: 'gray.800' } },
  },
});
