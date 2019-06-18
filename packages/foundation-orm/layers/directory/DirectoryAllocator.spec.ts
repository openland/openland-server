import { FConnection } from 'foundation-orm/FConnection';
import { DirectoryAllocator } from './DirectoryAllocator';
import { FKeyEncoding } from 'foundation-orm/utils/FKeyEncoding';
import { createNamedContext } from '@openland/context';

describe('DirectoryAllocator', () => {

    // Database Init
    let connection: FConnection;
    beforeAll(async () => {
        let db = FConnection.create()
            .at(FKeyEncoding.encodeKey(['_tests_allocator']));
        await db.clearRange(FKeyEncoding.encodeKey([]));
        connection = new FConnection(db);
        await connection.ready(createNamedContext('test'));
    });

    it('should allocate ids correctly', async () => {
        let allocator = new DirectoryAllocator(connection);
        let allocated = (await allocator.allocateDirectory(['test'])).toString('hex');
        let allocated2 = (await allocator.allocateDirectory(['test2'])).toString('hex');
        let allocated3 = (await allocator.allocateDirectory(['test'])).toString('hex');
        expect(allocated).toEqual('f0020001');
        expect(allocated2).toEqual('f0020002');
        expect(allocated).not.toEqual(allocated2);
        expect(allocated).toEqual(allocated3);
    });
});