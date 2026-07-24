import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  build: {
    assetsInlineLimit: 0,
    minify: false,
  },
});
