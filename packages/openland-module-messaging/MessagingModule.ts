import { createAugmentationWorker } from './workers/AugmentationWorker';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { startEmailNotificationWorker } from './workers/EmailNotificationWorker';
import { startPushNotificationWorker } from './workers/PushNotificationWorker';
import { createDeliveryWorker } from './workers/DeliveryWorker';
import { createImmigrationWorker } from './workers/ImmigrationWorker';

export class MessagingModule {
    AugmentationWorker = createAugmentationWorker();
    
    start = () => {
        if (serverRoleEnabled('email_notifications')) {
            startEmailNotificationWorker();
        }
        if (serverRoleEnabled('push_notifications')) {
            startPushNotificationWorker();
        }
        createDeliveryWorker();
        createImmigrationWorker();
    }
}