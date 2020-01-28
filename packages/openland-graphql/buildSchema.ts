import * as fs from 'fs';
import { findAllFiles } from './utils/findAllFiles';

export function buildSchema(rootPath: string) {
    let schema = findAllFiles(rootPath, (src) => src.endsWith('.graphql')  && !src.endsWith('.draft.graphql'))
        .map((f) => fs.readFileSync(f, 'utf-8'))
        .sort()
        .join('\n');

    return schema;
}
