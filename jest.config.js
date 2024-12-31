module.exports = {
    testEnvironment: 'jsdom',
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    moduleNameMapper: {
      '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
        '<rootDir>/tests/mocks/fileMock.js',
      '\\.(css|less|scss|sass)$': '<rootDir>/tests/mocks/styleMock.js',
    },
    testMatch: [
      '<rootDir>/tests/**/*.test.js',
    ],
    transform: {
      '^.+\\.js$': 'babel-jest',
    },
    verbose: true,
  };