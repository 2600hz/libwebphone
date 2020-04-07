module.exports = {
  mode: "development",
  entry: "./src/index.js",
  output: {
    filename: "libwebphone.js",
    publicPath: "dist",
    library: "libwebphone",
    libraryTarget: "var",
  },
  devtool: "source-map",
  devServer: {
    hot: true,
  },
};
