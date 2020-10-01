import { SubscriberAsyncRepository } from './SubscriberAsyncRepository';
import { createNamedContext } from '@openland/context';
import { Database, inTx } from '@openland/foundationdb';

const ID0 = Buffer.from([0]);
const ID1 = Buffer.from([1]);
// const ID2 = Buffer.from([2]);
const ID3 = Buffer.from([3]);
const ID4 = Buffer.from([4]);
const ID5 = Buffer.from([5]);

describe('SubscriberAsyncRepository', () => {
    it('should register subscriptions', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest({ name: 'event-subscriber-async', layers: [] });
        let repo = new SubscriberAsyncRepository(db.allKeys);
        let feedId1 = ID0;
        let feedId2 = ID1;
        // let feedId3 = ID2;
        let subsId1 = ID3;
        let subsId2 = ID4;
        let subsId3 = ID5;

        // Add subscribers
        await inTx(root, async (ctx) => {
            await repo.addSubscriber(ctx, subsId1, feedId1);
            await repo.addSubscriber(ctx, subsId1, feedId2);
            await repo.addSubscriber(ctx, subsId2, feedId1);
        });

        // Check subscriber map
        await inTx(root, async (ctx) => {
            expect(await repo.getSubscriberFeeds(ctx, subsId1)).toMatchObject([feedId1, feedId2]);
            expect(await repo.getSubscriberFeeds(ctx, subsId2)).toMatchObject([feedId1]);
            expect(await repo.getSubscriberFeeds(ctx, subsId3)).toMatchObject([]);
        });
    });
});