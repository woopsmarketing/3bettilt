import { defineConfig, devices } from '@playwright/test';

/**
 * FishTilt's critical-path browser tests.
 *
 * Port 3221 keeps this clear of `apps/web`'s e2e server on 3211 and of both apps' dev
 * servers (3210 / 3220), so a session can have all of them up at once.
 *
 * `127.0.0.1`, not `localhost`: Next 16's dev server rejects requests from an origin it
 * does not recognise, and `next.config.ts` allow-lists the numeric loopback form that
 * Playwright uses by default.
 *
 * The server runs a PRODUCTION build. FishTilt is a static, publicly-cacheable site and
 * the thing worth testing is what a visitor actually gets — prerendered HTML — not what
 * the dev server assembles on the fly. Unlike `apps/web` there is no database to point at:
 * the app has none.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3221',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // `pnpm exec next start`, not `pnpm start`: the package's own `start` script already
    // pins port 3220, and layering a second `--port` on top of it only works because the
    // last flag wins. Invoking Next directly means one port is stated, once.
    command: 'pnpm build && pnpm exec next start --port 3221',
    url: 'http://127.0.0.1:3221',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
