import { startScheduller } from '../modules/workerQueue';
import { createSampleWorker } from './SampleWorker';
import { createExportWorker } from './FoldeExportWorker';
import { createEmailWorker } from './EmailWorker';
import { startEmailNotificationWorker } from './EmailNotificationWorker';
import { createPushWorker } from './PushWorker';
import { startPushNotificationWorker } from './PushNotificationWorker';

export const SampleWorker = createSampleWorker();
export const FoldeExportWorker = createExportWorker();
export const EmailWorker = createEmailWorker();
export const PushWorker = createPushWorker();

export async function initWorkers() {
    startScheduller();
    startEmailNotificationWorker();
    startPushNotificationWorker();
}