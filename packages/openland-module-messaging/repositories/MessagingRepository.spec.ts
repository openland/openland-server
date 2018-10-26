import * as fdb from 'foundationdb';
import { FKeyEncoding } from 'foundation-orm/utils/FKeyEncoding';
import { NativeValue } from 'foundationdb/dist/lib/native';
import { FConnection } from 'foundation-orm/FConnection';
import { AllEntities } from 'openland-module-db/schema';
import { MessagingRepository } from './MessagingRepository';
import { inTx } from 'foundation-orm/inTx';

describe('Messaging Repository', () => {
    // Database Init
    let db: fdb.Database<NativeValue, any>;
    let entities: AllEntities;

    beforeAll(async () => {
        db = FConnection.create()
            .at(FKeyEncoding.encodeKey(['_tests_messaging']));
        await db.clearRange(FKeyEncoding.encodeKey([]));
        entities = new AllEntities(new FConnection(db));
    });

    it('should increment conversation seq correctly', async () => {
        let repo = new MessagingRepository(entities);
        await inTx(async () => {
            expect(await repo.fetchConversationNextSeq('cid-1')).toBe(1);
            expect(await repo.fetchConversationNextSeq('cid-1')).toBe(2);
            expect(await repo.fetchConversationNextSeq('cid-2')).toBe(1);
        });
    });
});