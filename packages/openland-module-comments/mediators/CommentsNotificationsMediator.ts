import { injectable } from 'inversify';
import { lazyInject } from '../../openland-modules/Modules.container';
import { CommentsNotificationsRepository } from '../repositories/CommentsNotificationsRepository';
import { Context } from '@openland/context';
import { CommentPeerType } from '../repositories/CommentsRepository';
import { Comment } from '../../openland-module-db/store';
import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';
import { MessageSpan } from '../../openland-module-messaging/MessageInput';
import { BetterWorkerQueue } from 'openland-module-workers/BetterWorkerQueue';
import { Store } from 'openland-module-db/FDB';

@injectable()
export class CommentsNotificationsMediator {
    @lazyInject('CommentsNotificationsRepository')
    private readonly repo!: CommentsNotificationsRepository;

    private readonly queue = new BetterWorkerQueue<{ commentId: number }>(Store.CommentNotificationDeliveryQueue, { type: 'transactional', maxAttempts: 'infinite' });

    start = () => {
        if (serverRoleEnabled('workers')) {
            this.queue.addWorkers(100, async (parent, item) => {
                await this.repo.onNewComment(parent, item.commentId);
            });
        }
    }

    async subscribeToComments(parent: Context, peerType: CommentPeerType, peerId: number, uid: number, type: 'all' | 'direct') {
        return this.repo.subscribeToComments(parent, peerType, peerId, uid, type);
    }

    async unsubscribeFromComments(parent: Context, peerType: CommentPeerType, peerId: number, uid: number) {
        return this.repo.unsubscribeFromComments(parent, peerType, peerId, uid);
    }

    async getCommentsSubscription(parent: Context, peerType: CommentPeerType, peerId: number, uid: number) {
        return this.repo.getCommentsSubscription(parent, peerType, peerId, uid);
    }

    async onNewComment(parent: Context, comment: Comment) {
        await this.queue.pushWork(parent, { commentId: comment.id });
    }

    async onNewPeer(parent: Context, peerType: CommentPeerType, peerId: number, uid: number, mentions: MessageSpan[] = []) {
        return await this.repo.onNewPeer(parent, peerType, peerId, uid, mentions);
    }
}