import { BetterWorkerQueue } from 'openland-module-workers/BetterWorkerQueue';
import { injectable } from 'inversify';
import { lazyInject } from '../../openland-modules/Modules.container';
import { FeedChannelInput, FeedChannelRepository, FeedChannelUpdateInput } from './FeedChannelRepository';
import { Context } from '@openland/context';
import { inTx } from '@openland/foundationdb';
import { AccessDeniedError } from '../../openland-errors/AccessDeniedError';
import { RichMessageInput } from '../../openland-module-rich-message/repositories/RichMessageRepository';
import { FeedRepository } from './FeedRepository';
import { NotFoundError } from '../../openland-errors/NotFoundError';
import { UserError } from '../../openland-errors/UserError';
import { Store } from '../../openland-module-db/FDB';
import { fetchNextDBSeq } from '../../openland-utils/dbSeq';
import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';
import { Modules } from '../../openland-modules/Modules';
import { batch } from '../../openland-utils/batch';

@injectable()
export default class FeedChannelMediator {
    @lazyInject('FeedChannelRepository')
    private readonly repo!: FeedChannelRepository;

    @lazyInject('FeedRepository')
    private readonly feedRepo!: FeedRepository;

    private readonly autoSubscriptionQueue = new BetterWorkerQueue<{ channelId: number, peerType: 'room' | 'organization', peerId: number }>(Store.FeedAutoSubscriptionQueue, { type: 'transactional', maxAttempts: 'infinite' });
    private readonly autoSubscriptionQueueMultiple = new BetterWorkerQueue<{ channelId: number, uids: number[] }>(Store.FeedAutoSubscriptionMultipleQueue, { type: 'transactional', maxAttempts: 'infinite' });

    start = () => {
        if (serverRoleEnabled('workers')) {
            this.autoSubscriptionQueue.addWorkers(100, async (parent, item) => {
                await this.fanOutSubscription(parent, item.channelId, item.peerType, item.peerId);
            });

            this.autoSubscriptionQueueMultiple.addWorkers(100, async (parent, item) => {
                await inTx(parent, async ctx => {
                    let topic = await this.feedRepo.resolveTopic(ctx, 'channel-' + item.channelId);
                    for (let uid of item.uids) {
                        let subscriber = await this.feedRepo.resolveSubscriber(ctx, 'user-' + uid);
                        let subscription = await Store.FeedSubscription.findById(ctx, subscriber.id, topic.id);
                        if (!subscription) {
                            await this.subscribeChannel(ctx, uid, item.channelId);
                        }
                    }
                });
            });
        }
    }

    async createFeedChannel(parent: Context, uid: number, input: FeedChannelInput) {
        return this.repo.createFeedChannel(parent, uid, input);
    }

    async updateFeedChannel(parent: Context, channelId: number, uid: number, input: FeedChannelUpdateInput) {
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

    async addEditor(parent: Context, channelId: number, uid: number, by: number) {
        return await inTx(parent, async ctx => {
            let role = await this.repo.roleInChannel(ctx, channelId, by);
            if (role !== 'creator') {
                throw new AccessDeniedError();
            }
            return this.repo.addEditor(ctx, channelId, uid, by);
        });
    }

    async removeEditor(parent: Context, channelId: number, uid: number, by: number) {
        return await inTx(parent, async ctx => {
            let role = await this.repo.roleInChannel(ctx, channelId, by);
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
            await Store.FeedChannelPostsCount.increment(ctx, channelId);
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
            await Store.FeedChannelPostsCount.decrement(ctx, channelId);
            return this.feedRepo.deletePost(ctx, uid, postId);
        });
    }

    async markForIndexing(parent: Context, channelId: number) {
        return this.repo.markForIndexing(parent, channelId);
    }

    async getUserDraftsChannel(parent: Context, uid: number) {
        return inTx(parent, async ctx => {
            let state = await this.repo.getUserFeedState(ctx, uid);
            if (state.draftsChannelId) {
                return (await Store.FeedChannel.findById(ctx, state.draftsChannelId))!;
            }
            let id = await fetchNextDBSeq(ctx, 'feed-channel');
            let channel = await Store.FeedChannel.create(ctx, id, {
                ownerId: uid,
                title: `Drafts`,
                type: 'private',
                isHidden: true
            });
            state.draftsChannelId = channel.id;
            await channel.flush(ctx);
            return channel;
        });
    }

    async enableChannelAutoSubscription(parent: Context, uid: number, channelId: number, peerType: 'room' | 'organization', peerId: number) {
        return inTx(parent, async ctx => {
            if (peerType === 'room') {
                if (!await Modules.Messaging.room.userHaveAdminPermissionsInRoom(ctx, uid, peerId)) {
                    throw new AccessDeniedError();
                }
            } else if (peerType === 'organization') {
                if (!await Modules.Orgs.isUserAdmin(ctx, uid, peerId)) {
                    throw new AccessDeniedError();
                }
            }
            if (await this.repo.createAutoSubscription(parent, uid, channelId, peerType, peerId)) {
                await this.autoSubscriptionQueue.pushWork(ctx, { channelId, peerType, peerId });
            }
        });
    }

    async disableAutoSubscription(parent: Context, uid: number, channelId: number, peerType: 'room' | 'organization', peerId: number) {
        return inTx(parent, async ctx => {
            if (peerType === 'room') {
                if (!await Modules.Messaging.room.userHaveAdminPermissionsInRoom(ctx, uid, peerId)) {
                    throw new AccessDeniedError();
                }
            } else if (peerType === 'organization') {
                if (!await Modules.Orgs.isUserAdmin(ctx, uid, peerId)) {
                    throw new AccessDeniedError();
                }
            }
            let existing = await Store.FeedChannelAutoSubscription.findById(ctx, channelId, peerType, peerId);
            if (existing) {
                existing.enabled = false;
                await existing.flush(ctx);
            }
        });
    }

    async onAutoSubscriptionPeerNewMember(parent: Context, uid: number, peerType: 'room' | 'organization', peerId: number) {
        return inTx(parent, async ctx => {
            let autoSubscriptions = await Store.FeedChannelAutoSubscription.fromPeer.findAll(ctx, peerType, peerId);
            for (let autoSubscription of autoSubscriptions) {
                let topic = await this.feedRepo.resolveTopic(ctx, 'channel-' + autoSubscription.channelId);
                let subscriber = await this.feedRepo.resolveSubscriber(ctx, 'user-' + uid);
                let subscription = await Store.FeedSubscription.findById(ctx, subscriber.id, topic.id);
                if (!subscription) {
                    await this.subscribeChannel(ctx, uid, autoSubscription.channelId);
                }
            }
        });
    }

    private async fanOutSubscription(parent: Context, channelId: number, peerType: 'room' | 'organization', peerId: number) {
        return inTx(parent, async ctx => {
            let uids: number[] = [];
            if (peerType === 'room') {
                uids.push(...await Modules.Messaging.room.findConversationMembers(ctx, peerId));
            } else if (peerType === 'organization') {
                uids.push(...(await Store.OrganizationMember.organization.findAll(ctx, 'joined', peerId)).map(m => m.uid));
            }
            if (uids.length > 0) {
                let batches = batch(uids, 20);
                let tasks = batches.map(b => this.autoSubscriptionQueueMultiple.pushWork(ctx, {
                    channelId,
                    uids: b
                }));
                await Promise.all(tasks);
            }
        });
    }
}
