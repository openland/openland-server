import { SubscriberRepository } from './SubscriberRepository';
import { createNamedContext } from '@openland/context';
import { Database, inTx, createVersionstampRef } from '@openland/foundationdb';

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
        let vts1 = await inTx(root, async (ctx) => {
            let vt1 = createVersionstampRef(ctx);
            let vt2 = createVersionstampRef(ctx);
            let vt3 = createVersionstampRef(ctx);
            await repo.addSubscription(ctx, subsId1, feedId1, 'direct', true, 0, vt1.index);
            await repo.addSubscription(ctx, subsId1, feedId2, 'async', true, 1, vt2.index);
            await repo.addSubscription(ctx, subsId2, feedId1, 'direct', false, 2, vt3.index);
            return {
                vt1,
                vt2,
                vt3
            };
        });

        // Check subscriptions map
        await inTx(root, async (ctx) => {
            expect(await repo.getSubscriptions(ctx, subsId1)).toMatchObject([{
                feed: feedId1,
                state: {
                    generation: 1, mode: 'direct', forwardOnly: true, from: { seq: 0, state: vts1.vt1.resolved.value }, to: null, subscribed: true
                }
            }, {
                feed: feedId2,
                state: { generation: 1, mode: 'async', forwardOnly: true, from: { seq: 1, state: vts1.vt2.resolved.value }, to: null, subscribed: true }
            }]);

            expect(await repo.getSubscriptions(ctx, subsId2)).toMatchObject([{
                feed: feedId1,
                state: { generation: 1, mode: 'direct', forwardOnly: false, from: { seq: 2, state: vts1.vt3.resolved.value }, to: null, subscribed: true }
            }]);

            expect(await repo.getSubscriptions(ctx, subsId3)).toMatchObject([]);
        });

        // Remove subscription
        let vts2 = await inTx(root, async (ctx) => {
            let vt3 = createVersionstampRef(ctx);
            await repo.removeSubscription(ctx, subsId1, feedId1, 1, vt3.index);
            return vt3;
        });

        await inTx(root, async (ctx) => {
            expect(await repo.getSubscriptions(ctx, subsId1)).toMatchObject([{
                feed: feedId1,
                state: {
                    generation: 1, mode: 'direct', forwardOnly: true, from: { seq: 0, state: vts1.vt1.resolved.value }, to: { seq: 1, state: vts2.resolved.value }, subscribed: false
                }
            }, {
                feed: feedId2,
                state: { generation: 1, mode: 'async', forwardOnly: true, from: { seq: 1, state: vts1.vt2.resolved.value }, to: null, subscribed: true },
            }]);

            expect(await repo.getSubscriptions(ctx, subsId2)).toMatchObject([{
                feed: feedId1,
                state: { generation: 1, mode: 'direct', forwardOnly: false, from: { seq: 2, state: vts1.vt3.resolved.value }, to: null, subscribed: true }
            }]);

            expect(await repo.getSubscriptions(ctx, subsId3)).toMatchObject([]);
        });
    });
});