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
            '@utils': path.resolve(__dirname, './js-es2018')
        }
    },
    build: {
        outDir: 'assets',
        sourcemap: true,
        rollupOptions: {
            input: 'src/main.tsx',
            output: {
                entryFileNames: 'js/[name]-[hash].js',
                chunkFileNames: 'js/[name]-[hash].js',
                assetFileNames: 'assets/[name]-[hash].[ext]',
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
                        '@radix-ui/react-tabs'
                    ]
                }
            }
        }
    },
    server: {
        port: 5173,
        // Proxy `/api` to the backend. You can override the target by setting
        // the environment variable `SB_API_PORT` (e.g. SB_API_PORT=59277 npm run dev)
        proxy: {
            '/api': {
                target: `http://127.0.0.1:${process.env.SB_API_PORT || '53900'}`,
                changeOrigin: true
            }
        }
    }
});
