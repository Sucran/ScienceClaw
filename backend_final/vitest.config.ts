import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.d.ts',
        '**/*.config.ts',
        'tests/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        'src/routes/**',      // Routes require full HTTP server setup
        'src/middleware/**',  // Middleware requires HTTP context
        'src/db/**',          // Database requires MongoDB connection
        'src/types/**'        // Type definitions have no executable code
      ],
      thresholds: {
        lines: 25,
        functions: 38,
        branches: 70,
        statements: 25
      }
    },
    testTimeout: 10000,
    hookTimeout: 10000
  },
  resolve: {
    alias: {
      '@': '/src'
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs']
  }
})
