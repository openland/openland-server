import { generate } from '../foundation-orm-gen/generate';
import { declareSchema, entity, field, primaryKey, enableTimestamps, enableVersioning, enumField, rangeIndex, uniqueIndex } from '../foundation-orm-gen';

const Schema = declareSchema(() => {
    entity('Online', () => {
        primaryKey('uid', 'number');
        field('lastSeen', 'number');
    });

    entity('Presence', () => {
        primaryKey('uid', 'number');
        primaryKey('tid', 'string');
        field('lastSeen', 'number');
        field('lastSeenTimeout', 'number');
        field('platform', 'string');
    });

    entity('Counter', () => {
        primaryKey('name', 'string');
        field('value', 'number');
    });

    entity('AuthToken', () => {
        primaryKey('uuid', 'string');
        field('salt', 'string');
        field('uid', 'number');
        field('lastIp', 'string');
        uniqueIndex('salt', ['salt']);
        enableTimestamps();
        enableVersioning();
    });

    entity('ServiceCache', () => {
        primaryKey('service', 'string');
        primaryKey('key', 'string');
        field('value', 'string');
        enableTimestamps();
        enableVersioning();
    });

    entity('Lock', () => {
        primaryKey('key', 'string');
        field('seed', 'string');
        field('timeout', 'number');
        field('version', 'number');
        field('minVersion', 'number');
    });

    entity('Task', () => {
        primaryKey('taskType', 'string');
        primaryKey('uid', 'string');

        field('arguments', 'json');
        field('result', 'json').nullable();
        enumField('taskStatus', ['pending', 'executing', 'failing', 'failed', 'completed']);

        field('taskFailureCount', 'number').nullable();
        field('taskFailureTime', 'number').nullable();
        field('taskLockSeed', 'string').nullable();
        field('taskLockTimeout', 'number').nullable();
        field('taskFailureMessage', 'string').nullable();

        rangeIndex('pending', ['taskType', 'createdAt'])
            .withCondition((src) => src.taskStatus === 'pending');
        rangeIndex('executing', ['taskLockTimeout'])
            .withCondition((src) => src.taskStatus === 'executing');
        rangeIndex('failing', ['taskFailureTime'])
            .withCondition((src) => src.taskStatus === 'failing');

        enableTimestamps();
        enableVersioning();
    });

    entity('PushFirebase', () => {
        primaryKey('id', 'string');
        field('uid', 'number');
        field('tid', 'string');
        field('token', 'string');
        field('packageId', 'string');
        field('sandbox', 'boolean');
        field('enabled', 'boolean');
        rangeIndex('user', ['uid', 'id']);
        uniqueIndex('token', ['token']).withCondition(src => src.enabled);
        enableTimestamps();
        enableVersioning();
    });

    entity('PushApple', () => {
        primaryKey('id', 'string');
        field('uid', 'number');
        field('tid', 'string');
        field('token', 'string');
        field('bundleId', 'string');
        field('sandbox', 'boolean');
        field('enabled', 'boolean');
        rangeIndex('user', ['uid', 'id']);
        uniqueIndex('token', ['token']).withCondition(src => src.enabled);
        enableTimestamps();
        enableVersioning();
    });

    entity('PushWeb', () => {
        primaryKey('id', 'string');
        field('uid', 'number');
        field('tid', 'string');
        field('endpoint', 'string');
        field('enabled', 'boolean');
        rangeIndex('user', ['uid', 'id']);
        uniqueIndex('endpoint', ['endpoint']).withCondition(src => src.enabled);
        enableTimestamps();
        enableVersioning();
    });

    entity('UserProfilePrefil', () => {
        primaryKey('id', 'number');
        field('firstName', 'string').nullable();
        field('lastName', 'string').nullable();
        field('picture', 'string').nullable();
        enableTimestamps();
        enableVersioning();
    });
});

generate(Schema, __dirname + '/../openland-module-db/schema.ts');