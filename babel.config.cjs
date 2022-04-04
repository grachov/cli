const cwd = process.cwd();
const path = require('path');
const pkg = require(`${cwd}/package.json`);

module.exports = {
  overrides: [{
    exclude: pkg.files && (
      pkg.files.map(f => (
        path.join(cwd, f)
      ))),
    presets: [
      ['@babel/env', {
        modules: pkg.type !== 'module' && 'auto',
        exclude: ["proposal-dynamic-import"],
        targets: {
          node: '14'
        }
      }]
    ]
  }],
  env: {
    test: {
      plugins: [
        ['istanbul', {
          exclude: ['dist', 'test']
        }]
      ]
    }
  }
};
