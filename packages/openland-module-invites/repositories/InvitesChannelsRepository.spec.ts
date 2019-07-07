import 'reflect-metadata';
import { FDB } from './../../openland-module-db/FDB';
import { InvitesRoomRepository } from './InvitesRoomRepository';
import { createNamedContext } from '@openland/context';
import { testEnvironmentStart, testEnvironmentEnd } from 'openland-modules/testEnvironment';

describe('ChannelRepository', () => {

    beforeAll(async () => {
        await testEnvironmentStart('channel-invites');
    });
    afterAll(async () => {
        await testEnvironmentEnd();
    });

    it('should create links', async () => {
        let ctx = createNamedContext('test');
        let repo = new InvitesRoomRepository(FDB);
        let uuid = await repo.createRoomInviteLink(ctx, 1, 1);
        let res = await repo.resolveInvite(ctx, uuid);
        expect(res).not.toBeNull();
    });
});