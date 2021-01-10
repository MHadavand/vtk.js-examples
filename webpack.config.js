const path = require('path');
const webpack = require('webpack')

const vtkRules = require('vtk.js/Utilities/config/dependency.js').webpack.core.rules;

var example
try {
  example = process.env['EXAMPLE'].replace(/[\/]|\.\./g, '') || 'cone.js';
  console.log(`Using ${example}!`);
}
catch (error) {
  console.log("Using the generic index.js files")
  example = 'index.js'
}

module.exports = {
  entry: {
    app: path.join(__dirname, 'src', example),
  },
  output: {
    path: path.join(__dirname, 'dist'),
    filename: '[name].js',
  },
  module: {
    rules: [
      { test: /\.js$/, loader: 'babel-loader', exclude: /node_modules/ },
      { test: /\.html$/, loader: 'html-loader' },
      { test: /\.(png|jpg|ico)$/, use: 'url-loader?limit=81920' },
      { test: /\.svg$/, use: [{ loader: 'raw-loader' }] },
      { test: /\.css$/, use: ['style-loader', 'css-loader'] }
    ].concat(vtkRules),
  },
  resolve: {
    extensions: ['.js'],
  },
  devServer: {
    contentBase: path.join(__dirname, 'dist'),
    writeToDisk: true,
    compress: true,
    port: 9000,
    watchOptions: {
      poll: true
    }
  },
};

