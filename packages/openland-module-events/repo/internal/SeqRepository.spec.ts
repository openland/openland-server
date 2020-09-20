import { SeqRepository } from './SeqRepository';
import { createNamedContext } from '@openland/context';
import { Database } from '@openland/foundationdb';

const ZERO = Buffer.alloc(0);

describe('SeqRepository', () => {
    it('posting allocate seq', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest({ name: 'event-storage-posting', layers: [] });
        let repo = new SeqRepository(db.allKeys);

        // Initial state
        let seq = await repo.getCurrentSeqSnapshot(root, ZERO);
        expect(seq).toBe(0);

        // Allocate
        seq = await repo.allocateSeq(root, ZERO);
        expect(seq).toBe(1);
        seq = await repo.getCurrentSeqSnapshot(root, ZERO);
        expect(seq).toBe(1);

        // Should not allocate since user never was online
        let now = Date.now();
        let seq2 = await repo.allocateSeqIfOnline(root, ZERO, now);
        expect(seq2).toBeNull();
        seq = await repo.getCurrentSeqSnapshot(root, ZERO);
        expect(seq).toBe(1);

        // Should refresh online status
        await repo.refreshOnline(root, ZERO, now + 5000);

        // Allocate since user is online
        seq2 = await repo.allocateSeqIfOnline(root, ZERO, now + 4000);
        expect(seq2).toBe(2);
        seq = await repo.getCurrentSeqSnapshot(root, ZERO);
        expect(seq).toBe(2);

        // Should not allocate for expired
        seq2 = await repo.allocateSeqIfOnline(root, ZERO, now + 6000);
        expect(seq2).toBeNull();
        seq = await repo.getCurrentSeqSnapshot(root, ZERO);
        expect(seq).toBe(2);
    });
});