import { injectable } from 'inversify';
import { FeedRepository } from './repositories/FeedRepository';
import { Context } from '@openland/context';
import { JsonMap } from 'openland-utils/json';
import {
    RichMessageInput,
    RichMessageReaction
} from '../openland-module-rich-message/repositories/RichMessageRepository';
import { lazyInject } from '../openland-modules/Modules.container';
import { FeedDeliveryMediator } from './repositories/FeedDeliveryMediator';
import { FeedChannelInput, FeedChannelUpdateInput } from './repositories/FeedChannelRepository';
import FeedChannelMediator from './repositories/FeedChannelMediator';
import { serverRoleEnabled } from '../openland-utils/serverRoleEnabled';
import { feedChannelIndexer } from './workers/feedChannelIndexer';

@injectable()
export class FeedModule {

    @lazyInject('FeedRepository')
    private readonly repo!: FeedRepository;

    @lazyInject('FeedDeliveryMediator')
    private readonly delivery!: FeedDeliveryMediator;

    @lazyInject('FeedChannelMediator')
    private readonly channels!: FeedChannelMediator;

    start = () => {
        this.delivery.start();
        if (serverRoleEnabled('workers')) {
            feedChannelIndexer();
        }
    }

    async resolveSubscriber(parent: Context, key: string) {
        return this.repo.resolveSubscriber(parent, key);
    }

    async resolveTopic(parent: Context, key: string) {
        return this.repo.resolveTopic(parent, key);
    }

    async createEvent(parent: Context, topic: string, type: string, content: JsonMap) {
        return this.repo.createEvent(parent, topic, type, content);
    }

    async subscribe(parent: Context, subscriber: string, topic: string) {
        return this.repo.subscribe(parent, subscriber, topic);
    }

    async unsubscribe(parent: Context, subscriber: string, topic: string) {
        return this.repo.unsubscribe(parent, subscriber, topic);
    }

    async findSubscriptions(parent: Context, subscriber: string) {
        return this.repo.findSubscriptions(parent, subscriber);
    }

    async createPost(parent: Context, uid: number, topic: string, input: RichMessageInput) {
        return this.repo.createPost(parent, uid, topic, input);
    }

    async deletePost(parent: Context, uid: number, eventId: number) {
        return this.repo.deletePost(parent, uid, eventId);
    }

    async editPost(parent: Context, uid: number, eventId: number, input: RichMessageInput) {
        return this.repo.editPost(parent, uid, eventId, input);
    }

    async setReaction(parent: Context, uid: number, eventId: number, reaction: RichMessageReaction, reset: boolean = false) {
        return this.repo.setReaction(parent, uid, eventId, reaction, reset);
    }

    async deliverFeedItemUpdated(parent: Context, eventId: number) {
        return this.repo.deliverFeedItemUpdated(parent, eventId);
    }

    async createFeedChannel(parent: Context, uid: number, input: FeedChannelInput) {
        return await this.channels.createFeedChannel(parent, uid, input);
    }

    async updateFeedChannel(parent: Context, channelId: number, uid: number, input: FeedChannelUpdateInput) {
        return await this.channels.updateFeedChannel(parent, channelId, uid, input);
    }

    async subscribeChannel(parent: Context, uid: number, channelId: number) {
        return await this.channels.subscribeChannel(parent, uid, channelId);
    }

    async unsubscribeChannel(parent: Context, uid: number, channelId: number) {
        return await this.channels.unsubscribeChannel(parent, uid, channelId);
    }

    async roleInChannel(parent: Context, channelId: number, uid: number): Promise<'creator' | 'editor' | 'subscriber' | 'none'> {
        return await this.channels.roleInChannel(parent, channelId, uid);
    }

    async createPostInChannel(parent: Context, channelId: number, uid: number, input: RichMessageInput & { repeatKey?: string | null }) {
        return await this.channels.createPost(parent, channelId, uid, input);
    }

    async editPostInChannel(parent: Context, uid: number, postId: number, input: RichMessageInput) {
        return await this.channels.editPost(parent, uid, postId, input);
    }

    async deletePostInChannel(parent: Context, uid: number, postId: number) {
        return await this.channels.deletePost(parent, uid, postId);
    }

    async addEditor(parent: Context, channelId: number, uid: number, by: number) {
        return await this.channels.addEditor(parent, channelId, uid, by);
    }

    async removeEditor(parent: Context, channelId: number, uid: number, by: number) {
        return await this.channels.removeEditor(parent, channelId, uid, by);
    }

    async markChannelForIndexing(parent: Context, channelId: number) {
        return this.channels.markForIndexing(parent, channelId);
    }

    async getUserDraftsChannel(parent: Context, uid: number) {
        return this.channels.getUserDraftsChannel(parent, uid);
    }

    async onFeedRebuildNeeded(ctx: Context, subscriberId: number) {
        return this.delivery.onFeedRebuildNeeded(ctx, subscriberId);
    }
}