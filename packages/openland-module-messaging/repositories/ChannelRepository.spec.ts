import * as fdb from 'foundationdb';
import { FConnection } from 'foundation-orm/FConnection';
import { FKeyEncoding } from 'foundation-orm/utils/FKeyEncoding';
import { AllEntities } from 'openland-module-db/schema';
import { NativeValue } from 'foundationdb/dist/lib/native';
import { ChannelRepository } from './ChannelRepository';

describe('ChannelRepository', () => {
    // Database Init
    let db: fdb.Database<NativeValue, any>;
    let entities: AllEntities;

    beforeAll(async () => {
        db = FConnection.create()
            .at(FKeyEncoding.encodeKey(['_tests_channel_invites']));
        await db.clearRange(FKeyEncoding.encodeKey([]));
        entities = new AllEntities(new FConnection(db));
    });

    it('should create links', async () => {
        let repo = new ChannelRepository(entities);
        let uuid = await repo.createChannelInviteLink(1, 1);
        let res = await repo.resolveInvite(uuid);
        expect(res).not.toBeNull();
    });
});