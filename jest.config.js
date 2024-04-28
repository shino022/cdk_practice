module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  moduleDirectories: [
    '<rootDir>/node_modules', 
    '<rootDir>/src/api/authorizer/node_modules',
    '<rootDir>/src/api/users/node_modules',
  ],
};
