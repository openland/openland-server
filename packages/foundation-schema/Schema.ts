import { declareSchema, entity, field, primaryKey } from '../foundation-schema-gen';

export const Schema = declareSchema(() => {
    entity('Online', () => {
        primaryKey('uid', 'number');
        field('lastSeen', 'number');
    });

    entity('Presence', () => {
        primaryKey('uid', 'number');
        primaryKey('tid', 'number');
        field('lastSeen', 'number');
        field('lastSeenTimeout', 'number');
        field('platform', 'string');
    });

    entity('Counter', () => {
        primaryKey('name', 'string');
        field('value', 'number');
    });
});