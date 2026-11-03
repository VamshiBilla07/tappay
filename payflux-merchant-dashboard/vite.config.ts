import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
        // @pos/shared is copied into this directory for Vercel deployment.
        '@pos/shared': path.resolve(import.meta.dirname, './packages/shared/src/index.ts'),
      },
      // Force one runtime copy of viem across the shared package and this app.
      dedupe: ['viem'],
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
