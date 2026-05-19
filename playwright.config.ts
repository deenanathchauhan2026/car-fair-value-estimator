import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

const localLibs = resolve('.pw-libs/root/usr/lib/x86_64-linux-gnu');
process.env.LD_LIBRARY_PATH = [localLibs, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');

export default defineConfig({
  testDir: '.',
  testMatch: ['apps/extension/tests/e2e/**/*.spec.ts'],
  timeout: 30000,
  use: { ...devices['Desktop Chrome'] },
  reporter: 'list'
});
