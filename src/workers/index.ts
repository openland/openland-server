import { startScheduller } from '../modules/workerQueue';
import { createSampleWorker } from './SampleWorker';
import { createExportWorker } from './FoldeExportWorker';
import { createEmailWorker } from './EmailWorker';

export const SampleWorker = createSampleWorker();
export const FoldeExportWorker = createExportWorker();
export const EmailWorker = createEmailWorker();

export async function initWorkers() {
    startScheduller();
}