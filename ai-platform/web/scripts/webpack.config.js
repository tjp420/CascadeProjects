const path = require('path');

const TerserPlugin = require('terser-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (env, argv) => {
    const isProduction = argv.mode === 'production';

    return {
        entry: {
            'dashboard': './scripts/dashboard-scripts.js'
        },

        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: isProduction ? '[name].[contenthash].min.js' : '[name].js',
            chunkFilename: isProduction ? '[name].[contenthash].chunk.js' : '[name].chunk.js',
            clean: true,
            publicPath: '/'
        },

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
                                    modules: false
                                }]
                            ],
                            plugins: [
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
                    test: /\.(png|jpg|jpeg|gif|svg|ico)$/,
                    type: 'asset/resource',
                    generator: {
                        filename: 'images/[name].[hash][ext]'
                    }
                },
                {
                    test: /\.(woff|woff2|ttf|eot)$/,
                    type: 'asset/resource',
                    generator: {
                        filename: 'fonts/[name].[hash][ext]'
                    }
                }
            ]
        },

        optimization: {
            minimize: isProduction,
            minimizer: [
                new TerserPlugin({
                    terserOptions: {
                        compress: {
                            drop_console: isProduction,
                            drop_debugger: isProduction
                        },
                        format: {
                            comments: false
                        }
                    },
                    extractComments: false
                })
            ],
            splitChunks: {
                chunks: 'all',
                cacheGroups: {
                    vendor: {
                        test: /[\\/]node_modules[\\/]/,
                        name: 'vendors',
                        chunks: 'all',
                        priority: 10
                    },
                    common: {
                        name: 'common',
                        minChunks: 2,
                        chunks: 'all',
                        priority: 5,
                        reuseExistingChunk: true
                    }
                }
            },
            runtimeChunk: {
                name: 'runtime'
            }
        },

        resolve: {
            extensions: ['.js', '.json'],
            alias: {
                '@': path.resolve(__dirname, 'dashboard_components'),
                '@core': path.resolve(__dirname, 'dashboard_components/core')
            }
        },

        plugins: [
            new HtmlWebpackPlugin({
                template: './dashboard.html',
                filename: 'dashboard.html',
                chunks: ['dashboard']
            })
        ],

        devtool: isProduction ? 'source-map' : 'eval-source-map',

        performance: {
            hints: isProduction ? 'warning' : false,
            maxEntrypointSize: 512000,
            maxAssetSize: 512000
        },

        stats: {
            colors: true,
            modules: false,
            children: false,
            chunks: false,
            chunkModules: false
        },

        devServer: {
            contentBase: path.join(__dirname, 'dist'),
            compress: true,
            port: 8080,
            hot: true,
            overlay: {
                warnings: true,
                errors: true
            },
            proxy: {
                '/api': {
                    target: 'http://localhost:8081',
                    changeOrigin: true,
                    secure: false
                }
            }
        }
    };
};
