import { injectable } from 'inversify';
import { lazyInject } from '../openland-modules/Modules.container';
import { AllEntities } from '../openland-module-db/schema';
import { Context } from '@openland/context';
import { inTx } from '../foundation-orm/inTx';
import { Modules } from '../openland-modules/Modules';
import { UserStateRepository } from '../openland-module-messaging/repositories/UserStateRepository';
import { CommentPeerType } from './CommentsRepository';
import { RoomRepository } from '../openland-module-messaging/repositories/RoomRepository';

@injectable()
export class CommentsNotificationsRepository {
    @lazyInject('FDB')
    private readonly entities!: AllEntities;
    @lazyInject('UserStateRepository')
    private readonly userState!: UserStateRepository;
    @lazyInject('RoomRepository')
    private readonly roomRepo!: RoomRepository;

    async getNotificationsChat(parent: Context, uid: number): Promise<number> {
        return await inTx(parent, async (ctx) => {
            let userState = await this.entities.CommentNotifications.findById(ctx, uid);
            if (userState)  {
                return userState.chat;
            }
            let chat = await this.roomRepo.createRoom(
                ctx,
                'group',
                undefined,
                uid,
                [],
                {title: 'Comments'},
                false,
                false
            );
            let state = await this.userState.getUserDialogState(ctx, uid, chat.id);
            state.disableGlobalCounter = true;
            state.hidden = true;
            await state.flush(ctx);
            await this.entities.CommentNotifications.create(ctx, uid, { chat: chat.id });
            return chat.id;
        });
    }

    async subscribeToComments(parent: Context, peerType: CommentPeerType, peerId: number, uid: number) {
        return await inTx(parent, async (ctx) => {
            let existing = await this.entities.CommentSubscription.findById(ctx, peerType, peerId, uid);
            if (existing) {
                return true;
            }
            await this.entities.CommentSubscription.create(ctx, peerType, peerId, uid, { kind: 'all', status: 'active' });
            return true;
        });
    }

    async getCommentsSubscription(parent: Context, peerType: CommentPeerType, peerId: number, uid: number) {
        return await inTx(parent, async (ctx) => {
            return await this.entities.CommentSubscription.findById(ctx, peerType, peerId, uid);
        });
    }

    async onNewComment(parent: Context, commentId: number) {
        return await inTx(parent, async (ctx) => {
            let supportId = await Modules.Users.getSupportUserId(ctx);
            if (!supportId) {
                return;
            }
            let comment = (await this.entities.Comment.findById(ctx, commentId))!;
            let subscriptions = await this.entities.CommentSubscription.allFromPeer(ctx, comment.peerType, comment.peerId);
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
                let cid = await this.getNotificationsChat(ctx, subscription.uid);
                await Modules.Messaging.sendMessage(ctx, cid, supportId, { message: 'new comment! ' + comment.id, attachments: [{ type: 'comment_attachment', commentId: comment.id }] }, true);
            }
        });
    }
}