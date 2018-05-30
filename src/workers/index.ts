import { startScheduller } from '../modules/workerQueue';
import { createSampleWorker } from './SampleWorker';

export const SampleWorker = createSampleWorker();

export async function initWorkers() {
    startScheduller();
}