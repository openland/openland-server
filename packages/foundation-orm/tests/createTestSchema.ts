import { generate } from '../../foundation-orm-gen/generate';
import { declareSchema, entity, field, primaryKey, enableVersioning, enableTimestamps, uniqueIndex } from '../../foundation-orm-gen';

const Schema = declareSchema(() => {
    entity('SimpleEntity', () => {
        primaryKey('id', 'number');
        field('data', 'string');
    });
    entity('VersionedEntity', () => {
        primaryKey('id', 'number');
        field('data', 'string');
        enableVersioning();
    });
    entity('TimestampedEntity', () => {
        primaryKey('id', 'number');
        field('data', 'string');
        enableTimestamps();
    });
    entity('IndexedEntity', () => {
        primaryKey('id', 'number');
        field('data1', 'string');
        field('data2', 'string');
        uniqueIndex('default', ['data1', 'data2', 'id']);
    });
});

generate(Schema, __dirname + '/testSchema.ts');