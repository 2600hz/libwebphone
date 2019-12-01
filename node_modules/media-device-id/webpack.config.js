const path = require('path');

module.exports = {
  entry: './src/media-device-id.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'media-device-id.min.js',
  },
  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
          },
        },
      },
    ],
  },
};
