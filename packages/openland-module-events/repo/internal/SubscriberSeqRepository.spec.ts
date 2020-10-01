import { SubscriberSeqRepository } from './SubscriberSeqRepository';
import { createNamedContext } from '@openland/context';
import { Database } from '@openland/foundationdb';

const ZERO = Buffer.alloc(0);

describe('SubscriberSeqRepository', () => {
    it('posting allocate seq', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest({ name: 'event-storage-posting', layers: [] });
        let repo = new SubscriberSeqRepository(db.allKeys);

        // Initial state
        let seq = await repo.getCurrentSeqSnapshot(root, ZERO);
        expect(seq).toBe(0);

        // Allocate
        seq = await repo.allocateSeq(root, ZERO);
        expect(seq).toBe(1);
        seq = await repo.getCurrentSeqSnapshot(root, ZERO);
        expect(seq).toBe(1);

        // Should not allocate since user never was online
        let now = Math.floor(Date.now() / 1000);
        expect(await repo.isOnline(root, ZERO, now + 4)).toBe(false);
        // let seq2 = await repo.allocateSeqIfOnline(root, ZERO, now);
        // expect(seq2).toBeNull();
        seq = await repo.getCurrentSeqSnapshot(root, ZERO);
        expect(seq).toBe(1);

        // Should refresh online status
        expect(await repo.refreshOnline(root, ZERO, now + 5)).toBeNull();
        expect(await repo.refreshOnline(root, ZERO, now + 6)).toBe(now + 5);

        // Should be online
        expect(await repo.isOnline(root, ZERO, now + 4)).toBe(true);

        // Allocate since user is online
        seq = await repo.allocateSeq(root, ZERO);
        expect(seq).toBe(2);
        seq = await repo.getCurrentSeqSnapshot(root, ZERO);
        expect(seq).toBe(2);

        // Should not allocate for expired
        // seq2 = await repo.allocateSeqIfOnline(root, ZERO, now + 6000);
        // expect(seq2).toBeNull();
        seq = await repo.getCurrentSeqSnapshot(root, ZERO);
        expect(seq).toBe(2);
    });
});