import { VostokSchema } from './vostok.schema';
import * as fs from 'fs';
import { generateSchema } from './generator';

fs.writeFileSync(__dirname + '/VostokTypes.ts', generateSchema(VostokSchema));