import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { NotificationInput } from './NotificationCenterRepository';
import { lazyInject } from '../openland-modules/Modules.container';
import { NotificationCenterMediator } from './NotificationCenterMediator';

@injectable()
export class NotificationCenterModule {
    @lazyInject('NotificationCenterMediator')
    private readonly mediator!: NotificationCenterMediator;

    start = () => {
        // Nothing to do
    }

    async sendNotification(ctx: Context, uid: number, notificationInput: NotificationInput) {
        return await this.mediator.sendNotification(ctx, uid, notificationInput);
    }

    async notificationCenterForUser(ctx: Context, uid: number) {
        return await this.mediator.notificationCenterForUser(ctx, uid);
    }

    async readUserNotification(ctx: Context, nid: number, uid: number) {
        return this.mediator.readUserNotification(ctx, nid, uid);
    }
}