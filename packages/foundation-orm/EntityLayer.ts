import { Context } from '@openland/context';
import { FPubsub } from 'foundation-orm/FPubsub';
import { FDirectoryLayer } from './layers/FDirectoryLayer';
import { FConnection } from 'foundation-orm/FConnection';

export class EntityLayer {
    readonly directory: FDirectoryLayer;
    readonly db: FConnection;
    readonly eventBus: FPubsub;

    constructor(db: FConnection, eventBus: FPubsub) {
        this.directory = new FDirectoryLayer(db);
        this.db = db;
        this.eventBus = eventBus;
    }

    async ready(ctx: Context) {
        await this.directory.ready(ctx);
    }
}