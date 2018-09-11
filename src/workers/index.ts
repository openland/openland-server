import { startScheduller } from '../modules/workerQueue';
import { createSampleWorker } from './SampleWorker';
import { createExportWorker } from './FoldeExportWorker';
import { createEmailWorker } from './EmailWorker';
import { startEmailNotificationWorker } from './EmailNotificationWorker';
import { createPushWorker } from './PushWorker';
// import { startPushNotificationWorker } from './PushNotificationWorker';
import { createWallPostsWorker } from './WallPostsWorker';
import { createConversationMessagesWorker } from './ConversationMessagesWorker';
import { serverRoleEnabled } from '../utils/serverRoles';

export const SampleWorker = createSampleWorker();
export const FoldeExportWorker = createExportWorker();
export const EmailWorker = createEmailWorker();
export const PushWorker = createPushWorker();
export const WallPostsWorker = createWallPostsWorker();
export const ConversationMessagesWorker = createConversationMessagesWorker();

export async function initWorkers() {
    startScheduller();
    if (serverRoleEnabled('email_notifications')) {
        startEmailNotificationWorker();
    }
    // if (serverRoleEnabled('push_notifications')) {
    //     startPushNotificationWorker();
    // }
}