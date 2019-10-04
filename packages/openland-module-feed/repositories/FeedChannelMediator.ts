import { injectable } from 'inversify';
import { lazyInject } from '../../openland-modules/Modules.container';
import { FeedChannelInput, FeedChannelRepository } from './FeedChannelRepository';
import { Context } from '@openland/context';
import { inTx } from '@openland/foundationdb';
import { AccessDeniedError } from '../../openland-errors/AccessDeniedError';

@injectable()
export default class FeedChannelMediator {
    @lazyInject('FeedChannelRepository')
    private readonly repo!: FeedChannelRepository;

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
}