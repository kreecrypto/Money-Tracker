import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import {readFileSync} from 'node:fs';

const {version:appVersion}=JSON.parse(readFileSync(new URL('./package.json',import.meta.url),'utf8')) as {version:string};

export default defineConfig({
  plugins: [react()],
  define: {
    __MONEY_APP_VERSION__: JSON.stringify(appVersion),
    __MONEY_BUILD_SHA__: JSON.stringify((process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || 'local').slice(0,8)),
    __MONEY_BUILT_AT__: JSON.stringify(new Date().toISOString()),
  },
  test: { environment: 'node' },
});
