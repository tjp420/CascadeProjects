import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: resolve(__dirname, 'coming-soon'),
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'coming-soon/index.html'),
        upload: resolve(__dirname, 'coming-soon/upload.html'),
        pricing: resolve(__dirname, 'coming-soon/pricing.html')
      }
    }
  },
  server: {
    port: 5173,
    proxy: process.env.API_PROXY_URL ? {
      '/api': process.env.API_PROXY_URL
    } : undefined
  }
});
