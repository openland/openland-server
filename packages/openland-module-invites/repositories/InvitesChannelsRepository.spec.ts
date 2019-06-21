import 'reflect-metadata';
import { AllEntities, AllEntitiesDirect } from 'openland-module-db/schema';
import { InvitesRoomRepository } from './InvitesRoomRepository';
import { NoOpBus } from 'foundation-orm/tests/NoOpBus';
import { createNamedContext } from '@openland/context';
import { EntityLayer } from 'foundation-orm/EntityLayer';
import { openTestDatabase } from 'openland-server/foundationdb';

describe('ChannelRepository', () => {
    // Database Init
    let entities: AllEntities;

    beforeAll(async () => {
        let db = await openTestDatabase();
        let layer = new EntityLayer(db, NoOpBus, 'app');
        entities = await AllEntitiesDirect.create(layer);
    });

    it('should create links', async () => {
        let ctx = createNamedContext('test');
        let repo = new InvitesRoomRepository(entities);
        let uuid = await repo.createRoomInviteLink(ctx, 1, 1);
        let res = await repo.resolveInvite(ctx, uuid);
        expect(res).not.toBeNull();
    });
});