module.exports = {
  mode: "production",
  entry: "./src/index.js",
  output: {
    filename: "libwebphone.js",
    publicPath: "dist",
    library: "libwebphone",
    libraryTarget: "var",
  },
};
