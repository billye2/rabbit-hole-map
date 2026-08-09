// @ts-check
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.mjs',
  timeout: 60_000,
  // Each test gets its own persistent context with the extension loaded;
  // serial keeps tracked-session state from leaking between tests.
  workers: 1,
  reporter: [['list']],
  use: {
    trace: 'retain-on-failure',
  },
});
