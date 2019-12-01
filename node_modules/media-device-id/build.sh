set -e

HEADER='/* Under MIT License by Mazuh. Original source code at: https://github.com/Mazuh/media-device-id */'
WEBPACK='./node_modules/webpack/bin/webpack.js'
OUTPUT='./dist/media-device-id.min.js'

$WEBPACK --mode=production
echo '[BUILD.SH]: Webpack OK.'

echo -n "$HEADER $(cat "$OUTPUT")" > $OUTPUT
echo '[BUILD.SH]: Custom bundle OK.'
