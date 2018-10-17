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
        'packages'
    ],
    testRegex: '.*\\.spec\\.(ts)x?$',
    testPathIgnorePatterns: ['/node_modules/'],
    coverageDirectory: 'coverage',
    mapCoverage: true,
    collectCoverageFrom: [
        'packages/**/*.{ts,tsx,js,jsx}',
        '!packages/**/*.d.ts',
        '!packages/tables/migrations/*.ts',
        '!packages/tables/data/*.ts',
        '!packages/tests/**/*',
    ]
};