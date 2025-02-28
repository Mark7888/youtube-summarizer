const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
    mode: 'development',
    devtool: 'source-map',
    entry: {
        background: './src/background.ts',
        content: './src/content.ts',
        settings: './src/settings.ts'
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].js'
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
        fallback: {
            "stream": false,
            "process": false
        }
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/
            }
        ]
    },
    plugins: [
        new CopyPlugin({
            patterns: [
                { from: 'src/manifest.json', to: 'manifest.json' },
                { from: 'src/settings.html', to: 'settings.html' },
                { from: 'src/icons', to: 'icons', noErrorOnMissing: true }
            ]
        })
    ]
};
