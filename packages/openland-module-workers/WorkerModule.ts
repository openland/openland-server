import { startScheduller } from './workerQueue';

export class WorkerModule {
    start = () => {
        startScheduller();
    }
}