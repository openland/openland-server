import { SubscriberRepository } from './SubscriberRepository';
import { createNamedContext } from '@openland/context';
import { Database, inTx } from '@openland/foundationdb';

const ID0 = Buffer.from([0]);
const ID1 = Buffer.from([1]);
// const ID2 = Buffer.from([2]);
const ID3 = Buffer.from([3]);
const ID4 = Buffer.from([4]);
const ID5 = Buffer.from([5]);

describe('SubscriberRepository', () => {
    it('should register subscriptions', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest({ name: 'event-subscriber-root', layers: [] });
        let repo = new SubscriberRepository(db.allKeys);
        let feedId1 = ID0;
        let feedId2 = ID1;
        // let feedId3 = ID2;
        let subsId1 = ID3;
        let subsId2 = ID4;
        let subsId3 = ID5;

        // Add subscribers
        await inTx(root, async (ctx) => {
            await repo.addSubscription(ctx, subsId1, feedId1, 'direct', true, 0);
            await repo.addSubscription(ctx, subsId1, feedId2, 'async', true, 1);
            await repo.addSubscription(ctx, subsId2, feedId1, 'direct', false, 2);
        });

        // Check subscriptions map
        await inTx(root, async (ctx) => {
            expect(await repo.getSubscriptions(ctx, subsId1)).toMatchObject([{
                feed: feedId1,
                state: { index: 1, mode: 'direct', strict: true, from: 0, to: null }
            }, {
                feed: feedId2,
                state: { index: 1, mode: 'async', strict: true, from: 1, to: null }
            }]);

            expect(await repo.getSubscriptions(ctx, subsId2)).toMatchObject([{
                feed: feedId1,
                state: { index: 1, mode: 'direct', strict: false, from: 2, to: null }
            }]);

            expect(await repo.getSubscriptions(ctx, subsId3)).toMatchObject([]);
        });

        // Remove subscription
        await inTx(root, async (ctx) => {
            await repo.removeSubscription(ctx, subsId1, feedId1, 1);
        });

        await inTx(root, async (ctx) => {
            expect(await repo.getSubscriptions(ctx, subsId1)).toMatchObject([{
                feed: feedId1,
                state: { index: 1, mode: 'direct', strict: true, from: 0, to: 1 }
            }, {
                feed: feedId2,
                state: { index: 1, mode: 'async', strict: true, from: 1, to: null }
            }]);

            expect(await repo.getSubscriptions(ctx, subsId2)).toMatchObject([{
                feed: feedId1,
                state: { index: 1, mode: 'direct', strict: false, from: 2, to: null }
            }]);

            expect(await repo.getSubscriptions(ctx, subsId3)).toMatchObject([]);
        });
    });
});