import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/helpers/**',
        'vitest.config.ts'
      ],
      thresholds: {
        branches: 90,
        functions: 90,
        lines: 90,
        statements: 90
      }
    },
    include: ['**/*.test.ts'],
    exclude: ['node_modules', 'dist']
  }
});