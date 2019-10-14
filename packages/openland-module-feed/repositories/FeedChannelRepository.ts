import { injectable } from 'inversify';
import { ImageRef } from '../../openland-module-media/ImageRef';
import { inTx } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { fetchNextDBSeq } from '../../openland-utils/dbSeq';
import { Store } from '../../openland-module-db/FDB';
import { lazyInject } from '../../openland-modules/Modules.container';
import { FeedRepository } from './FeedRepository';
import { Modules } from '../../openland-modules/Modules';
import { UserError } from '../../openland-errors/UserError';
import { NotFoundError } from '../../openland-errors/NotFoundError';
import { FeedDeliveryMediator } from './FeedDeliveryMediator';

/**
 * Channel types
 *
 * - open (default) (anyone can subscribe, admins can write)
 * - private (no one can subscribe, used for drafts, not showing in search)
 * - editorial not supported yet
 */

export interface FeedChannelInput {
    title: string;
    about?: string;
    image?: ImageRef;
    socialImage?: ImageRef;
    global?: boolean;
}

@injectable()
export class FeedChannelRepository {
    @lazyInject('FeedRepository')
    private readonly feedRepo!: FeedRepository;

    @lazyInject('FeedDeliveryMediator')
    private readonly delivery!: FeedDeliveryMediator;

    async createFeedChannel(parent: Context, uid: number, input: FeedChannelInput) {
        return await inTx(parent, async ctx => {
            if (input.global === true && !(await Modules.Super.isSuperAdmin(ctx, uid))) {
                throw new UserError('Only super-admins can create global channels');
            }
            let id = await fetchNextDBSeq(ctx, 'feed-channel');
            let channel =  await Store.FeedChannel.create(ctx, id, {
                ownerId: uid,
                title: input.title,
                about: input.about,
                image: input.image,
                socialImage: input.image,
                type: 'open',
                isGlobal: input.global
            });

            await Store.FeedChannelAdmin.create(ctx, channel.id, uid, { role: 'creator', enabled: true });
            await this.feedRepo.resolveTopic(ctx, 'channel-' + channel.id, input.global);
            await this.subscribeChannel(ctx, uid, channel.id);
            await this.markForIndexing(ctx, channel.id);
            if (input.global) {
                await this.delivery.onFeedRebuildNeeded(ctx);
            }
            return channel;
        });
    }

    async updateFeedChannel(parent: Context, channelId: number, uid: number, input: FeedChannelInput) {
        return await inTx(parent, async ctx => {
            let channel = await Store.FeedChannel.findById(ctx, channelId);
            if (!channel) {
                throw new NotFoundError();
            }
            if (input.global === true && !(await Modules.Super.isSuperAdmin(ctx, uid))) {
                throw new UserError('Only super-admins can create global channels');
            }
            if (input.title) {
                channel.title = input.title;
            }
            if (input.about !== undefined) {
                channel.about = input.about;
            }
            if (input.image !== undefined) {
                channel.image = input.image;
            }
            if (input.socialImage !== undefined) {
                channel.socialImage = input.socialImage;
            }
            if (input.global !== undefined) {
                channel.isGlobal = input.global;
                let topic = await Store.FeedTopic.key.find(ctx, 'channel-' + channel.id);
                if (topic) {
                    topic.isGlobal = channel.isGlobal;
                }
                await this.delivery.onFeedRebuildNeeded(ctx);
            }
            await this.markForIndexing(ctx, channelId);
            return channel;
        });
    }

    async subscribeChannel(parent: Context, uid: number, channelId: number) {
        return await inTx(parent, async ctx => {
            if (await this.feedRepo.subscribe(ctx, 'user-' + uid, 'channel-' + channelId)) {
                await Store.FeedChannelMembersCount.increment(ctx, channelId);
                await this.markForIndexing(ctx, channelId);
                let subscriber = await this.feedRepo.resolveSubscriber(ctx, 'user-' + uid);
                await this.delivery.onFeedRebuildNeeded(ctx, subscriber.id);
            }
        });
    }

    async unsubscribeChannel(parent: Context, uid: number, channelId: number) {
        return await inTx(parent, async ctx => {
            if (await this.feedRepo.unsubscribe(ctx, 'user-' + uid, 'channel-' + channelId)) {
                await Store.FeedChannelMembersCount.decrement(ctx, channelId);
                await this.markForIndexing(ctx, channelId);
                let subscriber = await this.feedRepo.resolveSubscriber(ctx, 'user-' + uid);
                await this.delivery.onFeedRebuildNeeded(ctx, subscriber.id);
            }
        });
    }

    async addEditor(parent: Context, channelId: number, uid: number, by: number) {
        return await inTx(parent, async ctx => {
            let existing = await Store.FeedChannelAdmin.findById(ctx, channelId, uid);
            if (existing) {
                existing.role = 'editor';
                existing.enabled = true;
                existing.promoter = by;
            } else {
                await Store.FeedChannelAdmin.create(ctx, channelId, uid, { role: 'editor', enabled: true, promoter: uid });
            }
        });
    }

    async removeEditor(parent: Context, channelId: number, uid: number) {
        return await inTx(parent, async ctx => {
            let channel = await Store.FeedChannel.findById(ctx, channelId);
            if (!channel) {
                throw new NotFoundError();
            }
            let existing = await Store.FeedChannelAdmin.findById(ctx, channelId, uid);
            if (existing) {
                if (existing.uid === channel.ownerId) {
                    throw new UserError(`Can't remove channel creator`);
                }
                existing.enabled = false;
            }
        });
    }

    async roleInChannel(parent: Context, channelId: number, uid: number): Promise<'creator' | 'editor' | 'subscriber' | 'none'> {
        return await inTx(parent, async ctx => {
            let channel = await Store.FeedChannel.findById(ctx, channelId);
            if (!channel) {
                throw new NotFoundError();
            }
            if (channel.ownerId === uid) {
                return 'creator';
            }
            let adminship = await Store.FeedChannelAdmin.findById(ctx, channelId, uid);
            if (adminship && adminship.enabled) {
                if (adminship.role === 'editor') {
                    return 'editor';
                }
            }
            let subscriber = await this.feedRepo.resolveSubscriber(ctx, 'user-' + uid);
            let topic = await this.feedRepo.resolveTopic(ctx, 'channel-' + channelId);
            let subscription = await Store.FeedSubscription.findById(ctx, subscriber.id, topic.id);
            if (subscription && subscription.enabled) {
                return 'subscriber';
            }

            return 'none';
        });
    }

    async markForIndexing(parent: Context, channelId: number) {
        return await inTx(parent, async (ctx) => {
            let existing = await Store.FeedChannelIndexingQueue.findById(ctx, channelId);
            if (existing) {
                existing.invalidate();
            } else {
                await Store.FeedChannelIndexingQueue.create(ctx, channelId, {});
            }
        });
    }

    async getUserFeedState(parent: Context, uid: number) {
        return inTx(parent, async ctx => {
            let existing = await Store.UserFeedState.findById(ctx, uid);
            if (existing) {
                return existing;
            }
            return await Store.UserFeedState.create(ctx, uid, { });
        });
    }
}