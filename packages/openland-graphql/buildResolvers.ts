import { findAllFiles } from './utils/findAllFiles';

export function buildResolvers(rootPath: string, forTest: boolean = false) {
    return findAllFiles(rootPath, (src) => src.endsWith(forTest ? 'resolver.ts' : 'resolver.js'))
        .map((v) => require(v).default || require(v).Resolver);
}
