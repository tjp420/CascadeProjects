// Webpack Configuration for Bundle Optimization and Code Splitting
// Optimizes main-app.js and other large JavaScript bundles

const path = require('path');

const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
    // Entry points for code splitting
    entry: {
        main: './src/dashboard.js',
        vendor: ['chart.js', 'chartjs-plugin-datalabels'],
        analytics: './src/analytics.js',
        filebrowser: './src/file-browser.js',
        alerts: './src/alerts.js',
        auth: './src/auth.js'
    },

    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].[contenthash].js',
        chunkFilename: '[name].[contenthash].chunk.js',
        clean: true, // Clean output directory
        publicPath: '/'
    },

    // Optimization configuration
    optimization: {
        minimize: true,
        minimizer: [
            new TerserPlugin({
                terserOptions: {
                    compress: {
                        drop_console: true, // Remove console.log in production
                        drop_debugger: true,
                        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn']
                    },
                    mangle: true,
                    format: {
                        comments: false
                    }
                },
                extractComments: false,
                parallel: true
            })
        ],

        // Code splitting configuration
        splitChunks: {
            chunks: 'all',
            cacheGroups: {
                // Vendor libraries chunk
                vendor: {
                    test: /[\\/]node_modules[\\/]/,
                    name: 'vendors',
                    chunks: 'all',
                    priority: 10,
                    reuseExistingChunk: true
                },

                // Common modules chunk
                common: {
                    name: 'common',
                    minChunks: 2,
                    chunks: 'all',
                    priority: 5,
                    reuseExistingChunk: true,
                    enforce: true
                },

                // Chart.js specific chunk
                charts: {
                    test: /[\\/]node_modules[\\/]chart\.js[\\/]/,
                    name: 'charts',
                    chunks: 'all',
                    priority: 15,
                    reuseExistingChunk: true
                },

                // Analytics modules chunk
                analytics: {
                    test: /[\\/]src[\\/]analytics[\\/]/,
                    name: 'analytics',
                    chunks: 'all',
                    priority: 20,
                    reuseExistingChunk: true
                },

                // File browser modules chunk
                filebrowser: {
                    test: /[\\/]src[\\/]file-browser[\\/]/,
                    name: 'filebrowser',
                    chunks: 'all',
                    priority: 20,
                    reuseExistingChunk: true
                },

                // Alert system chunk
                alerts: {
                    test: /[\\/]src[\\/]alerts[\\/]/,
                    name: 'alerts',
                    chunks: 'all',
                    priority: 20,
                    reuseExistingChunk: true
                },

                // Authentication chunk
                auth: {
                    test: /[\\/]src[\\/]auth[\\/]/,
                    name: 'auth',
                    chunks: 'all',
                    priority: 20,
                    reuseExistingChunk: true
                }
            }
        },

        // Runtime chunk configuration
        runtimeChunk: {
            name: 'runtime'
        },

        // Module concatenation
        concatenateModules: true,

        // Side effects optimization
        sideEffects: false
    },

    // Module resolution
    resolve: {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
        alias: {
            '@': path.resolve(__dirname, 'src'),
            '@components': path.resolve(__dirname, 'src/components'),
            '@utils': path.resolve(__dirname, 'src/utils'),
            '@styles': path.resolve(__dirname, 'src/styles')
        }
    },

    // Module rules
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: [
                            ['@babel/preset-env', {
                                targets: {
                                    browsers: ['> 1%', 'last 2 versions', 'not dead']
                                },
                                modules: false,
                                useBuiltIns: 'usage',
                                corejs: 3
                            }]
                        ],
                        plugins: [
                            '@babel/plugin-syntax-dynamic-import',
                            '@babel/plugin-proposal-class-properties',
                            '@babel/plugin-proposal-object-rest-spread'
                        ]
                    }
                }
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader']
            },
            {
                test: /\.(png|jpg|jpeg|gif|svg)$/,
                type: 'asset/resource',
                generator: {
                    filename: 'images/[name].[contenthash][ext]'
                }
            }
        ]
    },

    // Plugins
    plugins: [
    // Bundle analyzer plugin for development
        new (require('webpack-bundle-analyzer').BundleAnalyzerPlugin)({
            analyzerMode: 'static',
            openAnalyzer: false,
            reportFilename: 'bundle-report.html'
        })
    ],

    // Performance budgeting
    performance: {
        maxAssetSize: 244 * 1024, // 244KB per asset
        maxEntrypointSize: 244 * 1024, // 244KB per entry point
        hints: 'warning'
    },

    // Development vs production configuration
    mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',

    // Source maps configuration
    devtool: process.env.NODE_ENV === 'production' ? 'source-map' : 'eval-source-map',

    // Externals for CDN libraries
    externals: {
    // Chart.js can be loaded from CDN
        'chart.js': 'Chart'
    }
};
