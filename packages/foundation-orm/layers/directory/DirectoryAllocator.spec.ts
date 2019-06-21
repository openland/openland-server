import { DirectoryAllocator } from './DirectoryAllocator';
import { Database } from '@openland/foundationdb';
import { openTestDatabase } from 'openland-server/foundationdb';

describe('DirectoryAllocator', () => {

    // Database Init
    let db: Database;
    beforeAll(async () => {
        db = await openTestDatabase();
    });

    it('should allocate ids correctly', async () => {
        let allocator = new DirectoryAllocator(db, ['app']);
        let allocated = (await allocator.allocateDirectory(['test'])).prefix.toString('hex');
        let allocated2 = (await allocator.allocateDirectory(['test2'])).prefix.toString('hex');
        let allocated3 = (await allocator.allocateDirectory(['test'])).prefix.toString('hex');
        // console.warn(allocated);
        // console.warn(allocated2);
        // console.warn(allocated3);
        // expect(allocated).toEqual('f0020001');
        // expect(allocated2).toEqual('f0020002');
        expect(allocated).not.toEqual(allocated2);
        expect(allocated).toEqual(allocated3);
    });
});