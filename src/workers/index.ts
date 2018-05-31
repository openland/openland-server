import { startScheduller } from '../modules/workerQueue';
import { createSampleWorker } from './SampleWorker';
import { createExportWorker } from './FoldeExportWorker';

export const SampleWorker = createSampleWorker();
export const FoldeExportWorker = createExportWorker();

export async function initWorkers() {
    startScheduller();
}