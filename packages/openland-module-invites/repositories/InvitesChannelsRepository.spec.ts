import 'reflect-metadata';
import * as fdb from 'foundationdb';
import { FConnection } from 'foundation-orm/FConnection';
import { FKeyEncoding } from 'foundation-orm/utils/FKeyEncoding';
import { AllEntities, AllEntitiesDirect } from 'openland-module-db/schema';
import { NativeValue } from 'foundationdb/dist/lib/native';
import { InvitesRoomRepository } from './InvitesRoomRepository';
import { NoOpBus } from 'foundation-orm/tests/NoOpBus';
import { EmptyContext } from '@openland/context';

describe('ChannelRepository', () => {
    // Database Init
    let db: fdb.Database<NativeValue, any>;
    let entities: AllEntities;

    beforeAll(async () => {
        db = FConnection.create()
            .at(FKeyEncoding.encodeKey(['_tests_channel_invites']));
        await db.clearRange(FKeyEncoding.encodeKey([]));
        entities = new AllEntitiesDirect(new FConnection(db, NoOpBus));
    });

    it('should create links', async () => {
        let ctx = EmptyContext;
        let repo = new InvitesRoomRepository(entities);
        let uuid = await repo.createRoomInviteLink(ctx, 1, 1);
        let res = await repo.resolveInvite(ctx, uuid);
        expect(res).not.toBeNull();
    });
});