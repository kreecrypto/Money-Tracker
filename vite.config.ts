import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    __MONEY_BUILD_SHA__: JSON.stringify((process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || 'local').slice(0,8)),
    __MONEY_BUILT_AT__: JSON.stringify(new Date().toISOString()),
  },
  test: { environment: 'node' },
});
