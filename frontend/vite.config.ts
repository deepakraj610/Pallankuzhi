/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Chakra depends on framer-motion; separate chunks would be circular.
          'vendor-ui': ['@chakra-ui/react', '@emotion/react', '@emotion/styled', 'framer-motion'],
        },
      },
    },
  },
  server: { port: 5173 },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  },
});
