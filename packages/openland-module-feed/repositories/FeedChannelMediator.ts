import { injectable } from 'inversify';
import { lazyInject } from '../../openland-modules/Modules.container';
import { FeedChannelInput, FeedChannelRepository } from './FeedChannelRepository';
import { Context } from '@openland/context';
import { inTx } from '@openland/foundationdb';
import { AccessDeniedError } from '../../openland-errors/AccessDeniedError';
import { RichMessageInput } from '../../openland-module-rich-message/repositories/RichMessageRepository';
import { FeedRepository } from './FeedRepository';
import { NotFoundError } from '../../openland-errors/NotFoundError';
import { UserError } from '../../openland-errors/UserError';
import { Store } from '../../openland-module-db/FDB';

@injectable()
export default class FeedChannelMediator {
    @lazyInject('FeedChannelRepository')
    private readonly repo!: FeedChannelRepository;

    @lazyInject('FeedRepository')
    private readonly feedRepo!: FeedRepository;

    async createFeedChannel(parent: Context, uid: number, input: FeedChannelInput) {
        return this.repo.createFeedChannel(parent, uid, input);
    }

    async updateFeedChannel(parent: Context, channelId: number, uid: number, input: FeedChannelInput) {
        return await inTx(parent, async ctx => {
            let role = await this.repo.roleInChannel(ctx, channelId, uid);
            if (role !== 'creator') {
                throw new AccessDeniedError();
            }
            return this.repo.updateFeedChannel(ctx, channelId, uid, input);
        });
    }

    async subscribeChannel(parent: Context, uid: number, channelId: number) {
        return this.repo.subscribeChannel(parent, uid, channelId);
    }

    async unsubscribeChannel(parent: Context, uid: number, channelId: number) {
        return this.repo.unsubscribeChannel(parent, uid, channelId);
    }

    async addEditor(parent: Context, channelId: number, uid: number) {
        return await inTx(parent, async ctx => {
            let role = await this.repo.roleInChannel(ctx, channelId, uid);
            if (role !== 'creator') {
                throw new AccessDeniedError();
            }
            return this.repo.addEditor(ctx, channelId, uid);
        });
    }

    async removeEditor(parent: Context, channelId: number, uid: number) {
        return await inTx(parent, async ctx => {
            let role = await this.repo.roleInChannel(ctx, channelId, uid);
            if (role !== 'creator') {
                throw new AccessDeniedError();
            }
            return this.repo.removeEditor(ctx, channelId, uid);
        });
    }

    async roleInChannel(parent: Context, channelId: number, uid: number): Promise<'creator' | 'editor' | 'subscriber' | 'none'> {
        return this.repo.roleInChannel(parent, channelId, uid);
    }

    async createPost(parent: Context, channelId: number, uid: number, input: RichMessageInput & { repeatKey?: string | null }) {
        return await inTx(parent, async ctx => {
            let role = await this.repo.roleInChannel(ctx, channelId, uid);
            if (role !== 'creator' && role !== 'editor') {
                throw new AccessDeniedError();
            }
            return this.feedRepo.createPost(ctx, uid, 'channel-' + channelId, input);
        });
    }

    async editPost(parent: Context, uid: number, postId: number, input: RichMessageInput) {
        return await inTx(parent, async ctx => {
            let feedEvent = await Store.FeedEvent.findById(ctx, postId);
            if (!feedEvent) {
                throw new NotFoundError();
            }
            if (feedEvent.type !== 'post' || !feedEvent.content.richMessageId) {
                throw new UserError('No post found');
            }
            let message = await Store.RichMessage.findById(ctx, feedEvent.content.richMessageId);
            if (!message) {
                throw new UserError('Message not found');
            }
            if (message.uid !== uid) {
                throw new AccessDeniedError();
            }
            return this.feedRepo.editPost(ctx, uid, postId, input);
        });
    }

    async deletePost(parent: Context, uid: number, postId: number) {
        return await inTx(parent, async ctx => {
            let feedEvent = await Store.FeedEvent.findById(ctx, postId);
            if (!feedEvent) {
                throw new NotFoundError();
            }
            let topic = await Store.FeedTopic.findById(ctx, feedEvent.tid);
            if (!topic) {
                throw new NotFoundError();
            }
            if (!topic.key.startsWith('channel-')) {
                throw new AccessDeniedError();
            }
            let channelId = parseInt(topic.key.replace('channel-', ''), 10);
            let role = await this.repo.roleInChannel(ctx, channelId, uid);
            if (role !== 'creator' && role !== 'editor') {
                throw new AccessDeniedError();
            }
            return this.feedRepo.deletePost(ctx, uid, postId);
        });
    }
}