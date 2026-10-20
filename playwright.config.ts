import { defineConfig, devices } from '@playwright/test'

const useDevServer = process.env.E2E_SERVER === 'dev'
const e2ePort = process.env.E2E_PORT ?? '4173'
const e2eBaseURL = `http://127.0.0.1:${e2ePort}`

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: e2eBaseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
  },
  expect: {
    timeout: 15_000,
  },
  webServer: {
    command: useDevServer
      ? `npm run dev -- --host 127.0.0.1 --port ${e2ePort}`
      : `npx vite build && npm run preview -- --host 127.0.0.1 --port ${e2ePort}`,
    url: e2eBaseURL,
    reuseExistingServer: useDevServer && !process.env.CI,
    timeout: 120_000,
  },
})
