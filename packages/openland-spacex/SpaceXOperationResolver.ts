import { DocumentNode } from 'graphql';
import { parse } from 'graphql';

export class SpaceXOperationResolver {

    private cache = new Map<string, DocumentNode>();

    async resolve(body: string): Promise<DocumentNode> {
        let cached = this.cache.get(body);
        if (cached) {
            return cached;
        }
        let parsed = parse(body);
        this.cache.set(body, parsed);
        return parsed;
    }
}