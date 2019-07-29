import { testEnvironmentEnd, testEnvironmentStart, randomTestUser } from 'openland-modules/testEnvironment';
import { StatsModule } from './StatsModule';
import { container } from 'openland-modules/Modules.container';
import { createNamedContext } from '@openland/context';
import { loadMessagingTestModule } from 'openland-module-messaging/Messaging.container.test';
import { loadUsersModule } from 'openland-module-users/UsersModule.container';
import { MessagingRepository } from 'openland-module-messaging/repositories/MessagingRepository';
import { RoomRepository } from 'openland-module-messaging/repositories/RoomRepository';
import { Modules } from 'openland-modules/Modules';
import { UsersModule } from 'openland-module-users/UsersModule';
import { OrganizationModule } from 'openland-module-organization/OrganizationModule';
import { SuperModule } from 'openland-module-super/SuperModule';
import { OrganizationRepository } from 'openland-module-organization/repositories/OrganizationRepository';
import { Message } from 'openland-module-db/store';
import { Store } from 'openland-module-db/FDB';
import { RoomMediator } from 'openland-module-messaging/mediators/RoomMediator';
import { MessagingMediator } from 'openland-module-messaging/mediators/MessagingMediator';

beforeAll(async () => {
    await testEnvironmentStart('Stats');
    loadMessagingTestModule();
    container
        .bind('OrganizationRepository')
        .to(OrganizationRepository)
        .inSingletonScope();
    container
        .bind(OrganizationModule)
        .toSelf()
        .inSingletonScope();
    container
        .bind(UsersModule)
        .toSelf()
        .inSingletonScope();
    loadUsersModule();
    container
        .bind(SuperModule)
        .toSelf()
        .inSingletonScope();
});

afterAll(async () => {
    await testEnvironmentEnd();
});

describe('StatsModule', () => {
    it('should return list of unread rooms', async () => {
        const ctx = createNamedContext('test');
        const statsModule = container.get<StatsModule>(StatsModule);

        const roomMediator = container.get<RoomMediator>('RoomMediator');
        const messagingMediator = container.get<MessagingMediator>('MessagingMediator');
        const users = container.get<UsersModule>(UsersModule);
        const USER1_ID = (await randomTestUser(ctx)).uid;
        const USER2_ID = (await randomTestUser(ctx)).uid;
        await users.createUserProfile(ctx, USER2_ID, { firstName: 'User Name' });
        const oid = (await Modules.Orgs.createOrganization(ctx, USER1_ID, { name: '1' })).id;

        const CHAT1_ID = (await roomMediator.createRoom(ctx, 'group', oid, USER1_ID, [], { title: 'Room' })).id;
        await roomMediator.inviteToRoom(ctx, CHAT1_ID, USER1_ID, [USER2_ID]);

        const members = await Store.RoomParticipant.active.findAll(ctx, CHAT1_ID);
        expect(members.length).toBe(2);

        const dialogs1 = await statsModule.getUnreadRoomByUserId(ctx, USER2_ID);

        const mid1 = await messagingMediator.sendMessage(ctx, USER1_ID, CHAT1_ID, { message: 'test' });
        const mid2 = await messagingMediator.sendMessage(ctx, USER1_ID, CHAT1_ID, { message: 'test' });

        const dialogs3 = await statsModule.getUnreadRoomByUserId(ctx, USER2_ID);
        // why dialog 3 is empty?
        console.log({ dialogs1, dialogs3 });
    });
});
