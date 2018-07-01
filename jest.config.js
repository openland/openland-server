module.exports = {
    testEnvironment: 'node',
    transform: {
        "^.+\\.tsx?$": "ts-jest"
    },
    moduleFileExtensions: [
        'ts',
        'tsx',
        'js',
        'jsx',
        'json',
        'node'
    ],
    moduleDirectories: [
        'node_modules',
        'src'
    ],
    testRegex: '.*\\.spec\\.(ts)x?$',
    testPathIgnorePatterns: ['/node_modules/'],
    coverageDirectory: 'coverage',
    mapCoverage: true,
    collectCoverageFrom: [
        'src/**/*.{ts,tsx,js,jsx}',
        '!src/**/*.d.ts',
        '!src/tables/migrations/*.ts',
        '!src/tables/data/*.ts',
        '!src/tests/**/*',
    ]
};