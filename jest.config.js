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
    testResultsProcessor: 'jest-teamcity-reporter',
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
    ],
    moduleNameMapper: {

        //
        // WARNING: ORDER MATTERS
        //
        'foundation-orm-gen/(.*)': '<rootDir>/packages/foundation-orm-gen/$1',
        'foundation-orm-gen': '<rootDir>/packages/foundation-orm-gen',
        'foundation-orm/(.*)': '<rootDir>/packages/foundation-orm/$1',
        'foundation-orm': '<rootDir>/packages/foundation-orm',
        'openland-server-tests/(.*)': '<rootDir>/packages/openland-server-tests/$1',
        'openland-server-tests': '<rootDir>/packages/openland-server-tests',
        // 'openland-server/(.*)': '<rootDir>/packages/openland-server/$1',
        // 'openland-server': '<rootDir>/packages/openland-server',
        'openland-modules/(.*)': '<rootDir>/packages/openland-modules/$1',
        'openland-modules': '<rootDir>/packages/openland-modules',
        'openland-module-email/(.*)': '<rootDir>/packages/openland-module-email/$1',
        'openland-module-email': '<rootDir>/packages/openland-module-email',
        'openland-module-presences/(.*)': '<rootDir>/packages/openland-module-presences/$1',
        'openland-module-presences': '<rootDir>/packages/openland-module-presences',
        'openland-module-push/(.*)': '<rootDir>/packages/openland-module-push/$1',
        'openland-module-push': '<rootDir>/packages/openland-module-push',
        'openland-module-workers/(.*)': '<rootDir>/packages/openland-module-workers/$1',
        'openland-module-workers': '<rootDir>/packages/openland-module-workers',
        'openland-module-organization/(.*)': '<rootDir>/packages/openland-module-organization/$1',
        'openland-module-organization': '<rootDir>/packages/openland-module-organization',
        'openland-module-media/(.*)': '<rootDir>/packages/openland-module-media/$1',
        'openland-module-media': '<rootDir>/packages/openland-module-media',
        'openland-module-api/(.*)': '<rootDir>/packages/openland-module-api/$1',
        'openland-module-api': '<rootDir>/packages/openland-module-api',
        'openland-module-social/(.*)': '<rootDir>/packages/openland-module-social/$1',
        'openland-module-social': '<rootDir>/packages/openland-module-social',
        'openland-module-feed/(.*)': '<rootDir>/packages/openland-module-feed/$1',
        'openland-module-feed': '<rootDir>/packages/openland-module-feed',
        'openland-module-hooks/(.*)': '<rootDir>/packages/openland-module-hooks/$1',
        'openland-module-hooks': '<rootDir>/packages/openland-module-hooks',
        'openland-repositories/(.*)': '<rootDir>/packages/openland-repositories/$1',
        'openland-repositories': '<rootDir>/packages/openland-repositories',
        'openland-utils/(.*)': '<rootDir>/packages/openland-utils/$1',
        'openland-utils': '<rootDir>/packages/openland-utils',
        'openland-log/(.*)': '<rootDir>/packages/openland-log/$1',
        'openland-log': '<rootDir>/packages/openland-log',
        'openland-errors/(.*)': '<rootDir>/packages/openland-errors/$1',
        'openland-errors': '<rootDir>/packages/openland-errors',
        'openland-security/(.*)': '<rootDir>/packages/openland-security/$1',
        'openland-security': '<rootDir>/packages/openland-security',
    }
};