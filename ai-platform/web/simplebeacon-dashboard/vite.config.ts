import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiPort = env.VITE_API_PORT || process.env.VITE_API_PORT || '53900';

  return {
    root: path.resolve(__dirname, '.'),
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
          entryFileNames: '[name]-[hash].js',
          chunkFileNames: '[name]-[hash].js',
          assetFileNames: '[name]-[hash].[ext]',
          manualChunks: {
            // Split heavy third-party dependencies so no single chunk exceeds ~500 KB
            'vendor-react': ['react', 'react-dom'],
            'vendor-charts': ['recharts'],
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
          },
        },
      },
    },
    server: {
      port: 61455,
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${apiPort}`,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
