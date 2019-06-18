import { inTx } from '@openland/foundationdb';
import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import { NotificationCenterRepository, NotificationInput } from '../repositories/NotificationCenterRepository';
import { AllEntities } from '../../openland-module-db/schema';
import { Context } from '@openland/context';
import { NotFoundError } from '../../openland-errors/NotFoundError';
import { AccessDeniedError } from '../../openland-errors/AccessDeniedError';
import { NeedDeliveryRepository } from '../repositories/NeedDeliveryRepository';

@injectable()
export class NotificationCenterMediator {
    @lazyInject('NotificationCenterRepository')
    private readonly repo!: NotificationCenterRepository;
    @lazyInject('FDB')
    private readonly fdb!: AllEntities;
    @lazyInject('NeedDeliveryRepository')
    private readonly needDelivery!: NeedDeliveryRepository;

    async sendNotification(parent: Context, uid: number, notificationInput: NotificationInput) {
        return await inTx(parent, async (ctx) => {
            let notificationCenter = await this.notificationCenterForUser(ctx, uid);

            //
            // Create notification
            //
            let res = await this.repo.createNotification(ctx, notificationCenter.id, notificationInput);

            // Mark user as needed notification
            await this.needDelivery.setNeedNotificationDelivery(ctx, uid);

            return res;
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

    async deleteUserNotification(parent: Context, nid: number, uid: number) {
        return await inTx(parent, async (ctx) => {
            let notification = await this.fdb.Notification.findById(ctx, nid);
            if (!notification) {
                throw new NotFoundError();
            }
            let userNotificationCenter = await this.notificationCenterForUser(ctx, uid);
            if (userNotificationCenter.id !== notification.ncid) {
                throw new AccessDeniedError();
            }

            return this.repo.deleteNotification(ctx, nid);
        });
    }

    async markAsSeqRead(parent: Context, uid: number, toSeq: number) {
        return await inTx(parent, async (ctx) => {
            let userNotificationCenter = await this.notificationCenterForUser(ctx, uid);
            return this.repo.markAsSeqRead(ctx, userNotificationCenter.id, toSeq);
        });
    }

    async getNotificationStateForUser(parent: Context, uid: number) {
        return await inTx(parent, async (ctx) => {
            let userNotificationCenter = await this.notificationCenterForUser(ctx, uid);
            return this.repo.getNotificationState(ctx, userNotificationCenter.id);
        });
    }

    async markNotificationAsUpdated(parent: Context, nid: number) {
        return await this.repo.markNotificationAsUpdated(parent, nid);
    }
}