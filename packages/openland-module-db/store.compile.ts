import 'reflect-metadata';
// require('module-alias/register');
import schema from './store.schema';
import { compile } from '@openland/foundationdb-compiler';
import fs from 'fs';
let compiled = compile(schema);
fs.writeFileSync(__dirname + '/store.ts', compiled);