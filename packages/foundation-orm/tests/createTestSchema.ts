import { generate } from '../../foundation-orm-gen/generate';
import { declareSchema, entity, field, primaryKey } from '../../foundation-orm-gen';

const Schema = declareSchema(() => {
    entity('SimpleEntity', () => {
        primaryKey('id', 'number');
        field('data', 'string');
    });
});

generate(Schema, __dirname + '/testSchema.ts');