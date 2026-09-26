// @nestjs/* 12 ships ESM only, while jest runs these tests as CommonJS:
// compile those packages' .js files down to CJS (import.meta included).
const babelJest = require('babel-jest').default;

const babel = babelJest.createTransformer({
  babelrc: false,
  configFile: false,
  presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }]],
  plugins: ['babel-plugin-transform-import-meta'],
});

const CREATE_REQUIRE = /const require = createRequire\(/;

module.exports = {
  ...babel,
  // A module-level `const require = createRequire(...)` collides with the
  // `require` calls Babel emits for imports; rename it before compiling.
  process(source, filename, options) {
    const patched = CREATE_REQUIRE.test(source)
      ? source
          .replace(CREATE_REQUIRE, 'const nodeRequire = createRequire(')
          .replace(/(?<![.\w])require\(/g, 'nodeRequire(')
      : source;
    return babel.process(patched, filename, options);
  },
  getCacheKey(source, filename, options) {
    return babel.getCacheKey(source, filename, options) + ':rename-require-v1';
  },
};
