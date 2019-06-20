import { Context } from '@openland/context';
import { FPubsub } from 'foundation-orm/FPubsub';
import { FDirectoryLayer } from './layers/FDirectoryLayer';
import { Database } from '@openland/foundationdb';
import { RandomLayer } from '@openland/foundationdb-random';

export class EntityLayer {
    readonly directory: FDirectoryLayer;
    readonly db: Database;
    readonly eventBus: FPubsub;

    constructor(db: Database, eventBus: FPubsub) {
        this.directory = new FDirectoryLayer(db);
        this.db = db;
        this.eventBus = eventBus;
    }

    nextRandomId(): string {
        return this.db.get(RandomLayer).nextRandomId();
    }

    async ready(ctx: Context) {
        await this.directory.ready(ctx);
    }
}