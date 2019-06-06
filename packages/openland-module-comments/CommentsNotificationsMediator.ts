import { injectable } from 'inversify';
import { lazyInject } from '../openland-modules/Modules.container';
import { CommentsNotificationsRepository } from './CommentsNotificationsRepository';
import { Context } from '@openland/context';
import { CommentPeerType } from './CommentsRepository';
import { Comment } from '../openland-module-db/schema';
import { WorkQueue } from '../openland-module-workers/WorkQueue';
import { serverRoleEnabled } from '../openland-utils/serverRoleEnabled';

@injectable()
export class CommentsNotificationsMediator {
    private readonly queue = new WorkQueue<{ commentId: number }, { result: string }>('comments_notifications_delivery');

    start = () => {
        if (serverRoleEnabled('workers')) {
            this.queue.addWorker(async (item, parent) => {
                await this.repo.onNewComment(parent, item.commentId);
                return { result: 'ok' };
            });
        }
    }

    @lazyInject('CommentsNotificationsRepository')
    private readonly repo!: CommentsNotificationsRepository;

    async getNotificationsChat(parent: Context, uid: number): Promise<number> {
        return this.repo.getNotificationsChat(parent, uid);
    }

    async subscribeToComments(parent: Context, peerType: CommentPeerType, peerId: number, uid: number) {
        return this.repo.subscribeToComments(parent, peerType, peerId, uid);
    }

    async getCommentsSubscription(parent: Context, peerType: CommentPeerType, peerId: number, uid: number) {
        return this.repo.getCommentsSubscription(parent, peerType, peerId, uid);
    }

    async onNewComment(parent: Context, comment: Comment) {
        await this.queue.pushWork(parent, { commentId: comment.id });
    }
}