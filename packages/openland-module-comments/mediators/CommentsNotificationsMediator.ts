import { injectable } from 'inversify';
import { lazyInject } from '../../openland-modules/Modules.container';
import { CommentsNotificationsRepository } from '../repositories/CommentsNotificationsRepository';
import { Context } from '@openland/context';
import { CommentPeerType } from '../repositories/CommentsRepository';
import { Comment } from '../../openland-module-db/store';
import { WorkQueue } from '../../openland-module-workers/WorkQueue';
import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';

@injectable()
export class CommentsNotificationsMediator {
    @lazyInject('CommentsNotificationsRepository')
    private readonly repo!: CommentsNotificationsRepository;

    private readonly queue = new WorkQueue<{ commentId: number }, { result: string }>('comments_notifications_delivery');

    start = () => {
        if (serverRoleEnabled('workers')) {
            this.queue.addWorker(async (item, parent) => {
                await this.repo.onNewComment(parent, item.commentId);
                return { result: 'ok' };
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
}