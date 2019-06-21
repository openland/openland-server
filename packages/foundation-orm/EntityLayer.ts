import { createNamedContext } from '@openland/context';
import { FPubsub } from 'foundation-orm/FPubsub';
import { Database, inTx } from '@openland/foundationdb';
import { RandomLayer } from '@openland/foundationdb-random';

export class EntityLayer {
    readonly root: string;
    readonly db: Database;
    readonly eventBus: FPubsub;

    constructor(db: Database, eventBus: FPubsub, root: string) {
        this.root = root;
        this.db = db;
        this.eventBus = eventBus;
    }

    nextRandomId(): string {
        return this.db.get(RandomLayer).nextRandomId();
    }

    async resolveAtomicDirectory(name: string) {
        return await inTx(createNamedContext('entity'), async (ctx) => await this.db.directories.createOrOpen(ctx, ['com.openland.layers', 'layers', this.root, 'atomic', name]));
    }

    async resolveCustomDirectory(name: string) {
        return await inTx(createNamedContext('entity'), async (ctx) => await this.db.directories.createOrOpen(ctx, ['com.openland.layers', 'layers', this.root, 'custom', name]));
    }

    async resolveEntityDirectory(name: string) {
        return await inTx(createNamedContext('entity'), async (ctx) => await this.db.directories.createOrOpen(ctx, ['com.openland.layers', 'layers', this.root, 'entity', name]));
    }

    async resolveEntityIndexDirectory(entityName: string, indexName: string) {
        return await inTx(createNamedContext('entity'), async (ctx) => await this.db.directories.createOrOpen(ctx, ['com.openland.layers', 'layers', this.root, 'entity', entityName, '__indexes', indexName]));
    }
}