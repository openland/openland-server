import 'reflect-metadata';
import { Database } from '@openland/foundationdb';
import { FConnection } from 'foundation-orm/FConnection';
import { AllEntities, AllEntitiesDirect } from 'openland-module-db/schema';
import { InvitesRoomRepository } from './InvitesRoomRepository';
import { NoOpBus } from 'foundation-orm/tests/NoOpBus';
import { createNamedContext } from '@openland/context';
import { EntityLayer } from 'foundation-orm/EntityLayer';

describe('ChannelRepository', () => {
    // Database Init
    let entities: AllEntities;

    beforeAll(async () => {
        let db = await Database.openTest();
        let connection = new FConnection(db);
        let layer = new EntityLayer(connection, NoOpBus);
        entities = new AllEntitiesDirect(layer);
        await layer.ready(createNamedContext('test'));
    });

    it('should create links', async () => {
        let ctx = createNamedContext('test');
        let repo = new InvitesRoomRepository(entities);
        let uuid = await repo.createRoomInviteLink(ctx, 1, 1);
        let res = await repo.resolveInvite(ctx, uuid);
        expect(res).not.toBeNull();
    });
});