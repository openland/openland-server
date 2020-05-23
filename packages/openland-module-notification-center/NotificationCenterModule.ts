import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { lazyInject } from '../openland-modules/Modules.container';
import { NotificationCenterMediator } from './mediators/NotificationCenterMediator';
import { NotificationInput } from './repositories/NotificationCenterRepository';
import { NeedDeliveryRepository } from './repositories/NeedDeliveryRepository';
import { serverRoleEnabled } from '../openland-utils/serverRoleEnabled';
import { startPushNotificationWorker } from './workers/pushNotificationsWorker';
import { startEmailNotificationWorker } from './workers/emailNotificationsWorker';
import { CommentPeerType } from '../openland-module-comments/repositories/CommentsRepository';

@injectable()
export class NotificationCenterModule {
    @lazyInject('NeedDeliveryRepository')
    public readonly needDelivery!: NeedDeliveryRepository;
    @lazyInject('NotificationCenterMediator')
    private readonly mediator!: NotificationCenterMediator;

    start = async () => {
        if (serverRoleEnabled('workers')) {
            startPushNotificationWorker();
            startEmailNotificationWorker();
        }
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

    async deleteUserNotification(ctx: Context, nid: number, uid: number) {
        return this.mediator.deleteUserNotification(ctx, nid, uid);
    }
    async deleteNotification(ctx: Context, nid: number) {
        return this.mediator.deleteNotification(ctx, nid);
    }

    async markAsSeqRead(ctx: Context, uid: number, toSeq: number) {
        return this.mediator.markAsSeqRead(ctx, uid, toSeq);
    }

    async getNotificationStateForUser(ctx: Context, uid: number) {
        return this.mediator.getNotificationStateForUser(ctx, uid);
    }

    async markNotificationAsUpdated(ctx: Context, nid: number) {
        return this.mediator.markNotificationAsUpdated(ctx, nid);
    }

    async onCommentPeerUpdatedForUser(ctx: Context, uid: number, peerType: CommentPeerType, peerId: number, commentId: number | null) {
        return this.mediator.onCommentPeerUpdatedForUser(ctx, uid, peerType, peerId, commentId);
    }

    async onCommentPeerUpdated(ctx: Context, peerType: CommentPeerType, peerId: number, commentId: number | null) {
        return this.mediator.onCommentPeerUpdated(ctx, peerType, peerId, commentId);
    }
}