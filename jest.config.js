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
    ],
    moduleNameMapper: {

        //
        // WARNING: ORDER MATTERS
        //
        'foundation-orm-gen/(.*)': '<rootDir>/packages/foundation-orm-gen/$1',
        'foundation-orm-gen': '<rootDir>/packages/foundation-orm-gen',
        'foundation-orm/(.*)': '<rootDir>/packages/foundation-orm/$1',
        'foundation-orm': '<rootDir>/packages/foundation-orm',
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
        'openland-module-orgs/(.*)': '<rootDir>/packages/openland-module-orgs/$1',
        'openland-module-orgs': '<rootDir>/packages/openland-module-orgs',
        'openland-module-media/(.*)': '<rootDir>/packages/openland-module-media/$1',
        'openland-module-media': '<rootDir>/packages/openland-module-media',
        'openland-module-api/(.*)': '<rootDir>/packages/openland-module-api/$1',
        'openland-module-api': '<rootDir>/packages/openland-module-api',
        'openland-repositories/(.*)': '<rootDir>/packages/openland-repositories/$1',
        'openland-repositories': '<rootDir>/packages/openland-repositories',
        'openland-utils/(.*)': '<rootDir>/packages/openland-utils/$1',
        'openland-utils': '<rootDir>/packages/openland-utils',
        'openland-log/(.*)': '<rootDir>/packages/openland-log/$1',
        'openland-log': '<rootDir>/packages/openland-log',
        'openland-security/(.*)': '<rootDir>/packages/openland-security/$1',
        'openland-security': '<rootDir>/packages/openland-security',
    }
};