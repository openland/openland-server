import { createAugmentationWorker } from './workers/AugmentationWorker';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { startEmailNotificationWorker } from './workers/EmailNotificationWorker';
import { startPushNotificationWorker } from './workers/PushNotificationWorker';
import { MessagingRepository } from './repositories/MessagingRepository';
import { FDB } from 'openland-module-db/FDB';

export interface MessageInput {
    repeatToken?: string| null;
    text?: string| null;
    fileId?: string| null;
    fileMetadata?: any| null;
    filePreview?: string| null;
    mentions?: any| null;
    replyMessages?: any| null;
    augmentation?: any| null;
    isMuted: boolean;
    isService: boolean;
}

export class MessagingModule {
    readonly AugmentationWorker = createAugmentationWorker();
    readonly repo = new MessagingRepository(FDB);
    
    start = () => {
        if (serverRoleEnabled('workers')) {
            startEmailNotificationWorker();
        }
        if (serverRoleEnabled('workers')) {
            startPushNotificationWorker();
        }
    }
}