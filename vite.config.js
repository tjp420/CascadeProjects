import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: resolve(__dirname, 'coming-soon'),
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'coming-soon/index.html'),
        pricing: resolve(__dirname, 'coming-soon/pricing.html')
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) return 'vendor';
        }
      }
    },
    chunkSizeWarningLimit: 600
  },
  server: {
    port: 5173,
    proxy: process.env.API_PROXY_URL ? {
      '/api': process.env.API_PROXY_URL
    } : undefined
  }
});
