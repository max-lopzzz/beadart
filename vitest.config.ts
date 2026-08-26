import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./vitest.setup.ts'],
      globals: true,
      // Tests assume sharing is unconfigured by default (see
      // src/lib/sharing/config.ts) — pin these explicitly so a developer's
      // real .env.local (needed for manual testing) can't leak into test
      // runs and make "not configured" assertions flaky.
      env: {
        VITE_FIREBASE_API_KEY: '',
        VITE_FIREBASE_PROJECT_ID: '',
      },
    },
  }),
);
