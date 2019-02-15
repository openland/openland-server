import { generate } from '../../foundation-orm-gen/generate';
import {
    declareSchema,
    entity,
    field,
    primaryKey,
    enableVersioning,
    enableTimestamps,
    uniqueIndex,
    rangeIndex,
    jsonField
} from '../../foundation-orm-gen';
import { jField, jNumber, jString } from '../../openland-utils/jsonSchema';

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

    entity('RangeTest', () => {
        primaryKey('id', 'number');
        field('key', 'number');
        rangeIndex('default', ['key', 'id']);
    });

    entity('JsonTest', () => {
        primaryKey('id', 'number');
        jsonField('test', () => {
            jField('type', jString('link'));
            jField('offset', jNumber());
            jField('length', jNumber());
            jField('url', jString());
        });
    });
});

generate(Schema, __dirname + '/testSchema.ts');