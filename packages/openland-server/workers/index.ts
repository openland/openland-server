import { createSampleWorker } from './SampleWorker';
import { createEmailWorker } from './EmailWorker';
import { startEmailNotificationWorker } from './EmailNotificationWorker';
import { createConversationMessagesWorker } from './ConversationMessagesWorker';
import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';
import { startCallReaperWorker } from './CallReaper';

export const SampleWorker = createSampleWorker();
export const EmailWorker = createEmailWorker();
export const ConversationMessagesWorker = createConversationMessagesWorker();

export async function initWorkers() {
    startCallReaperWorker();
    if (serverRoleEnabled('email_notifications')) {
        startEmailNotificationWorker();
    }
}