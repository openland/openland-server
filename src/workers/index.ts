import { startScheduller } from '../modules/workerQueue';

export async function initWorkers() {
    startScheduller();
}