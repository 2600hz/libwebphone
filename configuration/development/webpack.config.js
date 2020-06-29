module.exports = {
  mode: "development",
  entry: "./src/index.js",
  output: {
    filename: "libwebphone.js",
    publicPath: "dist",
    library: "libwebphone",
    libraryTarget: "var",
  },
  performance: {
    hints: "warning",
  },
  devtool: "inline-source-map",
  devServer: {
    inline: true,
    liveReload: true,
  },
};
