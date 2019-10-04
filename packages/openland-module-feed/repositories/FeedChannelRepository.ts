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
            });

            await this.feedRepo.resolveTopic(ctx, 'channel-' + channel.id, input.global);
            await this.feedRepo.subscribe(ctx, 'user-' + uid, 'channel-' + channel.id);
            return channel;
        });
    }
}