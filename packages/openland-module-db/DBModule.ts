import { startMigrationsWorker } from './migrations';
import { AllEntities } from './schema';
import { FDB } from './FDB';

export class DBModule {

    readonly entities: AllEntities;

    constructor() {
        this.entities = FDB;
    }

    start = () => {
        require('./FDB');
        startMigrationsWorker();
    }
}