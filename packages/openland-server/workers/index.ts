import { createEmailWorker } from './EmailWorker';
import { startEmailNotificationWorker } from './EmailNotificationWorker';
import { createConversationMessagesWorker } from './ConversationMessagesWorker';
import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';

export const EmailWorker = createEmailWorker();
export const ConversationMessagesWorker = createConversationMessagesWorker();

export async function initWorkers() {
    if (serverRoleEnabled('email_notifications')) {
        startEmailNotificationWorker();
    }
}