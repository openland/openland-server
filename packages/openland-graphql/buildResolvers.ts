import { findAllFiles } from './utils/findAllFiles';

export function buildResolvers(rootPath: string) {
    return findAllFiles(rootPath, (src) => src.endsWith('resolver.js'))
        .map((v) => require(v).default);
}