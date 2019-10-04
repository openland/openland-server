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

export interface FeedChannelInput {
    title: string;
    about?: string;
    image?: ImageRef;
    global?: boolean;
}

@injectable()
export class FeedChannelRepository {
    @lazyInject('FeedRepository')
    private readonly feedRepo!: FeedRepository;

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
                isGlobal: input.global
            });

            await this.feedRepo.resolveTopic(ctx, 'channel-' + channel.id, input.global);
            await this.feedRepo.subscribe(ctx, 'user-' + uid, 'channel-' + channel.id);
            return channel;
        });
    }

    async updateFeedChannel(parent: Context, channelId: number, uid: number, input: FeedChannelInput) {
        return await inTx(parent, async ctx => {
            let channel = await Store.FeedChannel.findById(ctx, channelId);
            if (!channel) {
                throw new NotFoundError();
            }
            if (input.title) {
                channel.title = input.title;
            }
            if (input.about) {
                channel.title = input.about;
            }
            if (input.image) {
                channel.image = input.image;
            }
            if (input.global) {
                channel.isGlobal = input.global;
                let topic = await Store.FeedTopic.key.find(ctx, 'channel-' + channel.id);
                if (topic) {
                    topic.isGlobal = channel.isGlobal;
                }
            }
            return channel;
        });
    }
}