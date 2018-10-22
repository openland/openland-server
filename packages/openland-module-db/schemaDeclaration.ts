import { generate } from '../foundation-orm-gen/generate';
import { declareSchema, entity, field, primaryKey, enableTimestamps, enableVersioning, enumField, rangeIndex } from '../foundation-orm-gen';

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

    entity('UserToken', () => {
        primaryKey('uuid', 'string');
        field('uid', 'number');
        field('lastIp', 'string');
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
});

generate(Schema, __dirname + '/../openland-module-db/schema.ts');