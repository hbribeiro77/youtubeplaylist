import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:8081',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'npm run build && cd ../backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 8081',
    cwd: '.',
    env: {
      APP_ENV: 'test',
      DATABASE_URL: 'sqlite:///./data/test-e2e.db',
    },
    url: 'http://127.0.0.1:8081/health',
    reuseExistingServer: !process.env.CI,
  },
})
