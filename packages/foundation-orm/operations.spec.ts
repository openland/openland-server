import { FDirectoryLayer } from './layers/FDirectoryLayer';
import { FKeyEncoding } from 'foundation-orm/utils/FKeyEncoding';
import { copySubspace, deleteMissing } from './operations';
import { createNamedContext } from '@openland/context';
import { isSubspaceEquals } from './operations';
import { encoders, Database, inTx } from '@openland/foundationdb';
import { openTestDatabase } from 'openland-server/foundationdb';

describe('operations', () => {

    let db: Database;
    beforeAll(async () => {
        db = await openTestDatabase();
    });

    it('should copy subspaces', async () => {
        let parent = createNamedContext('copy');
        let directories = new FDirectoryLayer(db);
        let from = directories.getDirectory(['from']);
        let to = directories.getDirectory(['to']);
        await from.ready();
        await to.ready();

        // Preconditions
        let data = (await to.range(parent, Buffer.of()));
        expect(data.length).toBe(0);
        data = (await from.range(parent, Buffer.of()));
        expect(data.length).toBe(0);
        expect(await isSubspaceEquals(parent, to, from)).toBeTruthy();

        // Prefill
        await inTx(parent, async (ctx) => {
            for (let i = 0; i < 20000; i++) {
                from.set(ctx, FKeyEncoding.encodeKey([i]), encoders.json.pack({ v: i }));
            }
        });
        expect(await isSubspaceEquals(parent, to, from)).toBeFalsy();

        // Copy
        await copySubspace(parent, from, to);

        // Check results
        data = (await to.range(parent, Buffer.of()));
        expect(data.length).toBe(20000);
        for (let i = 0; i < 20000; i++) {
            expect(Buffer.compare(data[i].value, encoders.json.pack({ v: i }))).toBe(0);
            expect(Buffer.compare(data[i].key, FKeyEncoding.encodeKey([i]))).toBe(0);
        }
        expect(await isSubspaceEquals(parent, to, from)).toBeTruthy();

        //
        // Second pass
        //

        await inTx(parent, async (ctx) => {
            for (let i = 20000; i < 40000; i++) {
                from.set(ctx, FKeyEncoding.encodeKey([i]), encoders.json.pack({ v: i }));
            }
        });
        expect(await isSubspaceEquals(parent, to, from)).toBeFalsy();

        // Copy
        await copySubspace(parent, from, to);

        // Check results
        data = (await to.range(parent, Buffer.of()));
        expect(data.length).toBe(40000);
        for (let i = 0; i < 40000; i++) {
            expect(Buffer.compare(data[i].value, encoders.json.pack({ v: i }))).toBe(0);
            expect(Buffer.compare(data[i].key, FKeyEncoding.encodeKey([i]))).toBe(0);
        }
        expect(await isSubspaceEquals(parent, to, from)).toBeTruthy();

        //
        // Deletion
        //
        await inTx(parent, async (ctx) => {
            from.clear(ctx, FKeyEncoding.encodeKey([0]));
        });
        expect(await isSubspaceEquals(parent, to, from)).toBeFalsy();
        await deleteMissing(parent, from, to);
        expect(await isSubspaceEquals(parent, to, from)).toBeTruthy();
    });
});