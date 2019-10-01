import { injectable } from 'inversify';
import { ImageRef } from '../../openland-module-media/ImageRef';
import { inTx } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { fetchNextDBSeq } from '../../openland-utils/dbSeq';
import { Store } from '../../openland-module-db/FDB';
import { lazyInject } from '../../openland-modules/Modules.container';
import { FeedRepository } from './FeedRepository';

export interface FeedChannelInput {
    title: string;
    about?: string;
    image?: ImageRef;
    type: 'Open' | 'Editorial';
}

@injectable()
export class FeedChannelRepository {
    @lazyInject('FeedRepository')
    private readonly feedRepo!: FeedRepository;

    async createFeedChannel(parent: Context, uid: number, input: FeedChannelInput) {
        return await inTx(parent, async ctx => {
            let id = await fetchNextDBSeq(ctx, 'feed-channel');
            let channel =  await Store.FeedChannel.create(ctx, id, {
                ownerId: uid,
                title: input.title,
                about: input.about,
                image: input.image,
                type: input.type === 'Open' ? 'open' : 'editorial',
            });
            await this.feedRepo.resolveTopic(ctx, 'channel-' + channel.id);
            await this.feedRepo.subscribe(ctx, 'user-' + uid, 'channel-' + channel.id);
            return channel;
        });
    }
}