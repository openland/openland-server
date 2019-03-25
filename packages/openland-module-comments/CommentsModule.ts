import { injectable } from 'inversify';
import { lazyInject } from '../openland-modules/Modules.container';
import { CommentInput, CommentsRepository } from './CommentsRepository';
import { Context } from '../openland-utils/Context';

@injectable()
export class CommentsModule {
    @lazyInject('CommentsRepository')
    private readonly repo!: CommentsRepository;

    start = () => {

        // Nothing to do
    }

    async createComment(ctx: Context, peerType: 'message', peerId: number, uid: number, commentInput: CommentInput) {
        return this.repo.createComment(ctx, peerType, peerId, uid, commentInput);
    }
}