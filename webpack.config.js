const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: './src/plugin.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'virtual-advisor-plugin.js',
    library: 'VirtualAdvisorPlugin',
    libraryTarget: 'umd',
    globalObject: 'this'
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: [MiniCssExtractPlugin.loader, 'css-loader'],
      },
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: 'virtual-advisor-plugin.css',
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'src/plugin.html',
          to: 'virtual-advisor-plugin.html'
        }
      ],
    }),
  ],
  resolve: {
    extensions: ['.js', '.css'],
  },
};