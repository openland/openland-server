import { merge } from 'openland-utils/merge';
import { findAllFiles } from './utils/findAllFiles';
import * as Basics from '../openland-module-api/schema/Date';

export function buildResolvers(rootPath: string, forTest: boolean = false) {
    let resolvers = findAllFiles(rootPath, (src) => src.endsWith(forTest ? 'resolver.ts' : 'resolver.js'))
        .map((v) => require(v).default || require(v).Resolver);
    let merged = merge(
        Basics.Resolvers,
        ...resolvers
    );
    let rootResolvers: any = {};
    let processed: any = {};
    for (let key of merged) {
        let type = merged[key];
        let { __resolveRoot, ...other } = type;
        if (__resolveRoot) {
            rootResolvers[key] = __resolveRoot;
        }
        processed[key] = other;
    }
    return { resolvers: processed, rootResolvers: rootResolvers };
}
