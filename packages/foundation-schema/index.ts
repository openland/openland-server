import { generate } from '../foundation-schema-gen/generate';
import { Schema } from './Schema';

generate(Schema, __dirname + '/../openland-model/index.ts');