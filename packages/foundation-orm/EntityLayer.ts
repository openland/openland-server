import { RandomIDFactory } from 'openland-security/RandomIDFactory';
import { FNodeIDLayer } from './layers/FNodeIDLayer';
import { Context } from '@openland/context';
import { FPubsub } from 'foundation-orm/FPubsub';
import { FDirectoryLayer } from './layers/FDirectoryLayer';
import { FConnection } from 'foundation-orm/FConnection';

export class EntityLayer {
    readonly directory: FDirectoryLayer;
    readonly db: FConnection;
    readonly eventBus: FPubsub;
    readonly nodeIdLayer: FNodeIDLayer;

    private randomFactory: RandomIDFactory | null = null;

    constructor(db: FConnection, eventBus: FPubsub) {
        this.directory = new FDirectoryLayer(db);
        this.db = db;
        this.eventBus = eventBus;
        this.nodeIdLayer = new FNodeIDLayer(db);
    }

    nextRandomId(): string {
        if (this.randomFactory === null) {
            let nid = this.nodeIdLayer.nodeId;
            this.randomFactory = new RandomIDFactory(nid);
        }
        return this.randomFactory.next();
    }

    async ready(ctx: Context) {
        await this.directory.ready(ctx);
        await this.nodeIdLayer.ready();
    }
}