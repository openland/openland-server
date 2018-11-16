import { buildSchema } from '../../openland-graphql/buildSchema';
import { parse } from 'graphql';
import * as fs from 'fs';
import { genSchemeSpec } from './SchemaSpecGenerator';

let schema = buildSchema(__dirname + '/../../');
let schemeAst = parse(schema);
let res = genSchemeSpec(schemeAst);
fs.writeFileSync(__dirname + '/SchemaSpec.ts', res);