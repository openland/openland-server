import { FPubsub } from 'foundation-orm/FPubsub';
import { FDirectoryLayer } from './layers/FDirectoryLayer';
import { FConnection } from 'foundation-orm/FConnection';

export class EntityLayer {
    readonly directory: FDirectoryLayer;
    readonly db: FConnection;
    readonly eventBus: FPubsub;

    constructor(db: FConnection, directory: FDirectoryLayer, eventBus: FPubsub) {
        this.directory = directory;
        this.db = db;
        this.eventBus = eventBus;
    }
}