import { startScheduller } from '../modules/workerQueue';
import { createSampleWorker } from './SampleWorker';
import { createEmailWorker } from './EmailWorker';
import { startEmailNotificationWorker } from './EmailNotificationWorker';
import { createPushWorker } from './PushWorker';
import { startPushNotificationWorker } from './PushNotificationWorker';
import { createConversationMessagesWorker } from './ConversationMessagesWorker';
import { serverRoleEnabled } from '../utils/serverRoles';
import { startCallReaperWorker } from './CallReaper';

export const SampleWorker = createSampleWorker();
export const EmailWorker = createEmailWorker();
export const PushWorker = createPushWorker();
export const ConversationMessagesWorker = createConversationMessagesWorker();

export async function initWorkers() {
    startScheduller();
    startCallReaperWorker();
    if (serverRoleEnabled('email_notifications')) {
        startEmailNotificationWorker();
    }
    if (serverRoleEnabled('push_notifications')) {
        startPushNotificationWorker();
    }
}