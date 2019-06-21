import { Context } from '@openland/context';
import { FPubsub } from 'foundation-orm/FPubsub';
import { FDirectoryLayer } from './layers/FDirectoryLayer';
import { Database } from '@openland/foundationdb';
import { RandomLayer } from '@openland/foundationdb-random';

export class EntityLayer {
    readonly directory: FDirectoryLayer;
    readonly db: Database;
    readonly eventBus: FPubsub;

    constructor(db: Database, eventBus: FPubsub, root: string) {
        if (root.length === 0) {
            throw Error('');
        }
        this.directory = new FDirectoryLayer(db, ['com.openland.layers', 'layers', ...root]);
        this.db = db;
        this.eventBus = eventBus;
    }

    nextRandomId(): string {
        return this.db.get(RandomLayer).nextRandomId();
    }

    async resolveAtomicDirectory(name: string) {
        return await this.directory.getDirectory(['atomic', name]);
    }

    async resolveCustomDirectory(name: string) {
        return await this.directory.getDirectory(['custom', name]);
    }

    async resolveEntityDirectory(name: string) {
        return await this.directory.getDirectory(['entity', name]);
    }

    async resolveEntityIndexDirectory(entityName: string, indexName: string) {
        return await this.directory.getDirectory(['entity', entityName, '__indexes', indexName]);
    }

    async ready(ctx: Context) {
        await this.directory.ready(ctx);
    }
}