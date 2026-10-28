import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    /**
     * globalSetup runs once in the main process before any workers start.
     * It starts mongodb-memory-server and writes required env vars to
     * process.env. With pool:'forks', forked workers inherit those env vars.
     */
    globalSetup: './tests/setup/globalSetup.js',
    include: ['tests/**/*.test.js'],

    /**
     * pool:'forks' uses child_process.fork instead of worker_threads.
     * This is required so that env vars set in globalSetup are inherited
     * by each test worker process.
     */
    pool: 'forks',

    /**
     * Run test files sequentially to prevent concurrent database truncations
     * on the shared in-memory MongoDB instance.
     */
    fileParallelism: false,

    /**
     * Allow extra time for database operations in integration tests.
     */
    testTimeout: 15000,

    /**
     * Verbose reporter shows per-test pass/fail in CI output.
     */
    reporters: ['verbose'],
  },
});
