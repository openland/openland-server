import { generate } from '../../foundation-orm-gen/generate';
import { declareSchema, entity, field, primaryKey, enableVersioning, enableTimestamps, uniqueIndex, rangeIndex } from '../../foundation-orm-gen';

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
        field('data3', 'string');
        uniqueIndex('default', ['data1', 'data2', 'id']);
    });
    entity('IndexedRangeEntity', () => {
        primaryKey('id', 'number');
        field('data1', 'string');
        field('data2', 'string');
        field('data3', 'string');
        rangeIndex('default', ['data1', 'data2']);
    });

    entity('IndexedPartialEntity', () => {
        primaryKey('id', 'number');
        field('data1', 'string');
        field('data2', 'string');
        field('data3', 'string');
        uniqueIndex('default', ['data1', 'data2', 'id']).withCondition((src) => src.data1 === 'hello');
    });

    entity('NullableEntity', () => {
        primaryKey('id', 'number');
        field('flag', 'boolean').nullable();
    });
});

generate(Schema, __dirname + '/testSchema.ts');