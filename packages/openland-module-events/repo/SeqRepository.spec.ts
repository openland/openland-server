import { SeqRepository } from './SeqRepository';
import { createNamedContext } from '@openland/context';
import { Database } from '@openland/foundationdb';

describe('SeqRepository', () => {
    it('posting allocate seq', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest({ name: 'event-storage-posting', layers: [] });
        let repo = new SeqRepository(db.allKeys);

        // Initial state
        let seq = await repo.getCurrentSeqSnapshot(root, 1);
        expect(seq).toBe(0);

        // Allocate
        seq = await repo.allocateSeq(root, 1);
        expect(seq).toBe(1);
        seq = await repo.getCurrentSeqSnapshot(root, 1);
        expect(seq).toBe(1);

        // Should not allocate since user never was online
        let now = Date.now();
        let seq2 = await repo.allocateSeqIfOnline(root, 1, now);
        expect(seq2).toBeNull();
        seq = await repo.getCurrentSeqSnapshot(root, 1);
        expect(seq).toBe(1);

        // Should refresh online status
        await repo.refreshOnline(root, 1, now + 5000);

        // Allocate since user is online
        seq2 = await repo.allocateSeqIfOnline(root, 1, now + 4000);
        expect(seq2).toBe(2);
        seq = await repo.getCurrentSeqSnapshot(root, 1);
        expect(seq).toBe(2);

        // Should not allocate for expired
        seq2 = await repo.allocateSeqIfOnline(root, 1, now + 6000);
        expect(seq2).toBeNull();
        seq = await repo.getCurrentSeqSnapshot(root, 1);
        expect(seq).toBe(2);
    });
});