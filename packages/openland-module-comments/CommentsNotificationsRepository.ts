import { injectable } from 'inversify';
import { lazyInject } from '../openland-modules/Modules.container';
import { AllEntities } from '../openland-module-db/schema';
import { Context } from '@openland/context';
import { inTx } from '../foundation-orm/inTx';
import { CommentPeerType } from './CommentsRepository';
import { Modules } from '../openland-modules/Modules';

@injectable()
export class CommentsNotificationsRepository {
    @lazyInject('FDB')
    private readonly entities!: AllEntities;
    @lazyInject('UserStateRepository')

    async subscribeToComments(parent: Context, peerType: CommentPeerType, peerId: number, uid: number) {
        return await inTx(parent, async (ctx) => {
            let existing = await this.entities.CommentsSubscription.findById(ctx, peerType, peerId, uid);
            if (existing) {
                return true;
            }
            await this.entities.CommentsSubscription.create(ctx, peerType, peerId, uid, { kind: 'all', status: 'active' });
            return true;
        });
    }

    async getCommentsSubscription(parent: Context, peerType: CommentPeerType, peerId: number, uid: number) {
        return await inTx(parent, async (ctx) => {
            return await this.entities.CommentsSubscription.findById(ctx, peerType, peerId, uid);
        });
    }

    async onNewComment(parent: Context, commentId: number) {
        return await inTx(parent, async (ctx) => {
            let comment = (await this.entities.Comment.findById(ctx, commentId))!;
            let subscriptions = await this.entities.CommentsSubscription.allFromPeer(ctx, comment.peerType, comment.peerId);
            for (let subscription of subscriptions) {
                if (subscription.status !== 'active') {
                    continue;
                }
                if (comment.uid === subscription.uid) {
                    continue;
                }
                let settings = await Modules.Users.getUserSettings(ctx, subscription.uid);
                if (!settings.commentNotifications || settings.commentNotifications === 'none') {
                    continue;
                }
                // send notification here
                await Modules.NotificationCenter.sendNotification(ctx, subscription.uid, { content: [{ type: 'new_comment', commentId: comment.id }] });
            }
        });
    }
}