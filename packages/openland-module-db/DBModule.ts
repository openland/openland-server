import { startMigrationsWorker } from './migrations';
import { AllEntities } from './schema';
import { FDB } from './FDB';
import { injectable } from 'inversify';

@injectable()
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