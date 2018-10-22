import { createAugmentationWorker } from './workers/AugmentationWorker';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { startEmailNotificationWorker } from './workers/EmailNotificationWorker';
import { startPushNotificationWorker } from './workers/PushNotificationWorker';

export class MessagingModule {
    AugmentationWorker = createAugmentationWorker();
    
    start = () => {
        if (serverRoleEnabled('email_notifications')) {
            startEmailNotificationWorker();
        }
        if (serverRoleEnabled('push_notifications')) {
            startPushNotificationWorker();
        }
    }
}