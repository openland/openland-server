import { injectable } from 'inversify';
import { lazyInject } from '../openland-modules/Modules.container';
import { NotificationCenterRepository, NotificationInput } from './NotificationCenterRepository';
import { Context } from '@openland/context';
import { inTx } from '../foundation-orm/inTx';
import { AllEntities } from '../openland-module-db/schema';
import { NotFoundError } from '../openland-errors/NotFoundError';
import { AccessDeniedError } from '../openland-errors/AccessDeniedError';

@injectable()
export class NotificationCenterMediator {
    @lazyInject('NotificationCenterRepository')
    private readonly repo!: NotificationCenterRepository;
    @lazyInject('FDB')
    private readonly fdb!: AllEntities;

    async sendNotification(parent: Context, uid: number, notificationInput: NotificationInput) {
        return await inTx(parent, async (ctx) => {
            let notificationCenter = await this.notificationCenterForUser(ctx, uid);

            //
            // Create notification
            //
            return await this.repo.createNotification(ctx, notificationCenter.id, notificationInput);
        });
    }

    async notificationCenterForUser(parent: Context, uid: number) {
        return this.repo.notificationCenterForUser(parent, uid);
    }

    async readUserNotification(parent: Context, nid: number, uid: number) {
        return await inTx(parent, async (ctx) => {
            let notification = await this.fdb.Notification.findById(ctx, nid);
            if (!notification) {
                throw new NotFoundError();
            }
            let userNotificationCenter = await this.notificationCenterForUser(ctx, uid);
            if (userNotificationCenter.id !== notification.ncid) {
                throw new AccessDeniedError();
            }

            return this.repo.readNotification(ctx, nid);
        });
    }
}