import { declareSearchIndexer } from '../../openland-module-search/declareSearchIndexer';
import { Store } from '../../openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';

export function feedChannelIndexer() {
    declareSearchIndexer('feed-channel-index', 3, 'feed-channel', Store.FeedChannelIndexingQueue.updated.stream({ batchSize: 50 }))
        .withProperties({
            channelId: {
                type: 'integer'
            },
            title: {
                type: 'text'
            },
            about: {
                type: 'text'
            },
            subscribersCount: {
                type: 'integer'
            },
            createdAt: {
                type: 'date'
            },
            updatedAt: {
                type: 'date'
            },
        })
        .start(async (item, parent) => {
            return await inTx(parent, async (ctx) => {
                let channel = await Store.FeedChannel.findById(ctx, item.id);
                if (!channel) {
                    return null;
                }
                return {
                    id: item.id,
                    doc: {
                        channelId: channel.id,
                        title: channel.title,
                        about: channel.about || undefined,
                        subscribersCount: await Store.FeedChannelMembersCount.get(ctx, channel.id),
                        createdAt: channel.metadata.createdAt,
                        updatedAt: channel.metadata.updatedAt
                    }
                };
            });
        });
}