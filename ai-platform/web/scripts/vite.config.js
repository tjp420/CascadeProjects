import { resolve } from 'path';

import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
    const isProduction = mode === 'production';

    return {
        root: '.',
        base: '/',
    
        build: {
            outDir: 'dist',
            assetsDir: 'assets',
            sourcemap: !isProduction,
            minify: isProduction ? 'terser' : false,
            target: 'es2020',
      
            rollupOptions: {
                input: {
                    main: resolve(__dirname, 'index.html'),
                    dashboard: resolve(__dirname, 'dashboard.html'),
                    dashboard_simple: resolve(__dirname, 'dashboard_simple.html'),
                    dashboard_direct: resolve(__dirname, 'dashboard_direct.html'),
                    final_complete: resolve(__dirname, 'final_100_complete.html')
                },
        
                output: {
                    entryFileNames: isProduction ? '[name].[hash].js' : '[name].js',
                    chunkFileNames: isProduction ? '[name].[hash].js' : '[name].js',
                    assetFileNames: isProduction ? '[name].[hash].[ext]' : '[name].[ext]',
          
                    manualChunks: {
                        vendor: ['chart.js'],
                        core: [
                            './dashboard_components/core/DataEngine.js',
                            './dashboard_components/core/AiBridgeSimple.js'
                        ],
                        utils: [
                            './dashboard_components/core/KeyboardShortcuts.js',
                            './dashboard_components/core/DarkMode.js',
                            './dashboard_components/core/ResponsiveDesign.js'
                        ]
                    }
                }
            },
      
            chunkSizeWarningLimit: 1000
        },
    
        server: {
            port: 8080,
            host: true,
            open: true,
            cors: true,
      
            proxy: {
                '/api': {
                    target: 'http://localhost:8081',
                    changeOrigin: true,
                    secure: false
                }
            }
        },
    
        preview: {
            port: 8080,
            host: true,
            cors: true
        },
    
        optimizeDeps: {
            include: ['chart.js'],
            exclude: []
        },
    
        plugins: [
            // Add any additional plugins here
        ],
    
        resolve: {
            alias: {
                '@': resolve(__dirname, 'dashboard_components'),
                '@core': resolve(__dirname, 'dashboard_components/core')
            }
        },
    
        css: {
            devSourcemap: !isProduction,
            preprocessorOptions: {
                scss: {
                    additionalData: '@import "@/styles/variables.scss";'
                }
            }
        },
    
        define: {
            __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '2.0.0'),
            __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
            __IS_PRODUCTION__: isProduction
        },
    
        esbuild: {
            drop: isProduction ? ['console', 'debugger'] : []
        }
    };
});
