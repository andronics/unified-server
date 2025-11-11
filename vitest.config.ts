import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Run integration tests sequentially to avoid database conflicts
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.test.ts',
        '**/*.spec.ts',
        'src/server.ts',
      ],
    },
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@foundation': path.resolve(__dirname, './src/foundation'),
      '@infrastructure': path.resolve(__dirname, './src/infrastructure'),
      '@integration': path.resolve(__dirname, './src/integration'),
      '@application': path.resolve(__dirname, './src/application'),
    },
  },
});
