import { createEmailWorker } from './workers/EmailWorker';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { startEmailNotificationWorker } from './workers/EmailNotificationWorker';

export class EmailModule {
    readonly Worker = createEmailWorker();
    start = () => {
        if (serverRoleEnabled('email_notifications')) {
            startEmailNotificationWorker();
        }
    }
}