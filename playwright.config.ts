import { defineConfig, devices } from '@playwright/test';

// Гоняются против локального дев-сервера + локального Supabase-стека
// (supabase start, см. README «Локальное тестирование миграций»).
// Каждый тест регистрирует одноразового пользователя со случайным именем —
// не полагается на существующие данные, безопасно гонять повторно.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // В некоторых окружениях предустановлен только полный chromium (не
        // headless-shell вариант, который @playwright/test пытается
        // использовать по умолчанию для другой версии сборки). Если путь
        // не задан явно через PLAYWRIGHT_CHROMIUM_PATH, используем
        // стандартное разрешение Playwright.
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
          : {},
      },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000/login',
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
