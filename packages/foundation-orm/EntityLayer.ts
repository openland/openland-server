import { createNamedContext } from '@openland/context';
import { Database, inTx } from '@openland/foundationdb';
import { EventBus } from '@openland/foundationdb-bus';

export class EntityLayer {
    readonly root: string;
    readonly db: Database;
    readonly eventBus: EventBus<any>;

    constructor(db: Database, root: string) {
        this.root = root;
        this.db = db;
        this.eventBus = new EventBus<any>(db);
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