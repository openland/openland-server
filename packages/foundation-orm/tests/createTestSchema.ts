import { generate } from '../../foundation-orm-gen/generate';
import { declareSchema, entity, field, primaryKey, enableVersioning, enableTimestamps } from '../../foundation-orm-gen';

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
});

generate(Schema, __dirname + '/testSchema.ts');