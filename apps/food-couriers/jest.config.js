module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '\\.css$': '<rootDir>/__tests__/support/style-stub.js',
    '\\.(png|jpe?g|gif|webp|bmp|svg|ttf|otf|woff2?|mp4|mp3|wav|m4a)$':
      '<rootDir>/__tests__/support/asset-stub.js',
  },
  collectCoverageFrom: ['App.tsx', 'index.js', 'src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
  /**
   * 30s per test, not jest's default 5s.
   *
   * These suites are not unit tests: a screen case mounts the whole navigator
   * with its providers, drains eight scheduling turns, then fires every handler
   * the screen rendered. That is a second or two on a developer's machine and
   * several times that on a shared CI agent — one app's sweep took 11s locally
   * and 190s on the build box, where nine tests crossed the 5s limit and failed
   * a green build. The work is legitimate, so the limit is what has to move.
   *
   * Deliberately a real number rather than 0: a test that hangs should still
   * fail rather than wedge the run.
   */
  testTimeout: 30000,
  maxWorkers: '50%',
  workerIdleMemoryLimit: '1024MB',
  clearMocks: true,
  // see the rncli branch below
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/__tests__/support/'],
};
