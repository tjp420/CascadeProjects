import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  base: '/dashboard/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@services': path.resolve(__dirname, './js-es2018/services'),
      '@views': path.resolve(__dirname, './js-es2018/views'),
      '@utils': path.resolve(__dirname, './js-es2018'),
    },
  },
  build: {
    outDir: 'assets',
    sourcemap: true,
    rollupOptions: {
      input: 'src/main.tsx',
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
        manualChunks: {
          'vendor-recharts': ['recharts'],
          'vendor-radix': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-label',
            '@radix-ui/react-progress',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-separator',
            '@radix-ui/react-slot',
            '@radix-ui/react-tabs',
          ],
          'vendor-lucide': ['lucide-react'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:53900',
        changeOrigin: true,
      },
    },
  },
});
