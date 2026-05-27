import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

// Core modules that should be bundled
const coreModules = [
    'dashboard_components/core/DataEngine.js',
    'dashboard_components/core/ChartController.js', 
    'dashboard_components/core/AiBridge.js',
    'dashboard_components/core/EventManager.js'
];

// Consolidated modules (replaced redundant ones)
const consolidatedModules = [
    'dashboard_components/theme-manager-consolidated.js',
    'dashboard_components/export-manager-consolidated.js',
    'dashboard_components/chart-factory.js'
];

// Utility and feature modules
const utilityModules = [
    'dashboard_components/realtime-manager.js',
    'dashboard_components/cache-manager.js'
];

const input = 'dashboard_components/dashboard-core-refactored.js';

const output = [
    // Modern ES modules
    {
        file: 'dist/dashboard.bundle.js',
        format: 'es',
        sourcemap: isDevelopment
    }
];

const plugins = [
    // Resolve node_modules (for Chart.js, etc.)
    nodeResolve({
        browser: true,
        preferBuiltins: false
    }),
    
    // Convert CommonJS to ES modules
    commonjs({
        include: 'node_modules/**'
    }),
    
    // Minification for production
    ...(isProduction ? [
        terser({
            compress: {
                drop_console: true,
                drop_debugger: true,
                pure_funcs: ['console.log', 'console.info', 'console.debug']
            },
            mangle: {
                reserved: ['Chart', 'DashboardManager', 'ThemeManager', 'ExportManager', 'ChartFactory']
            },
            format: {
                comments: false
            }
        })
    ] : [])
];

export default {
    // Main configuration
    input: input,
    output: output,
    plugins: plugins,
    external: ['chart.js'], // Keep Chart.js external (loaded from CDN)
    onwarn: (warning, warn) => {
        // Suppress certain warnings
        if (warning.code === 'THIS_IS_UNDEFINED') {
            return;
        }
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') {
            return;
        }
        warn(warning);
    }
};
