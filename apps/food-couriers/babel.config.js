module.exports = function babelConfig(api) {
  // NativeWind's preset is skipped under NODE_ENV=test. Its jsx transform
  // injects a _ReactNativeCSSInterop reference that jest's
  // babel-plugin-jest-hoist rejects outright ("Invalid variable access"), so
  // EVERY suite fails to parse. Tests render components for behaviour, not for
  // styling, so dropping the transform there costs nothing.
  //
  // api.cache.using(), not api.cache(true): the config now depends on
  // NODE_ENV, and caching it unconditionally serves one env's result to the other.
  api.cache.using(() => process.env.NODE_ENV);
  const isTest = api.env('test');
  return {
    presets: isTest
      ? ['babel-preset-expo']
      : [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
    // Release builds ship no console.*. Response payloads were reaching
    // logcat/Console, readable by any other tooling on the device. `error` is
    // kept so genuine crash paths still surface.
    env: {
      production: {
        plugins: [['transform-remove-console', { exclude: ['error'] }]],
      },
    },
  };
};
