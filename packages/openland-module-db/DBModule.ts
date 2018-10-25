import { startMigrationsWorker } from './migrations';

export class DBModule {
    start = () => {
        require('./FDB');
        startMigrationsWorker();
    }
}