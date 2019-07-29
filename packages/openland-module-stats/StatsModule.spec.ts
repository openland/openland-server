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
import { inTx } from '@openland/foundationdb';
import { UserStateRepository } from 'openland-module-messaging/repositories/UserStateRepository';
import { DeliveryMediator } from 'openland-module-messaging/mediators/DeliveryMediator';
import { DeliveryRepository } from 'openland-module-messaging/repositories/DeliveryRepository';
import { CountersMediator } from 'openland-module-messaging/mediators/CountersMediator';

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

    container
        .bind(DeliveryRepository)
        .toSelf()
        .inSingletonScope();

    container
        .bind(CountersMediator)
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
        const urepo = container.get<UserStateRepository>('UserStateRepository');
        const ustate = container.get<UserStateRepository>('UserStateRepository');

        const deliveryRepo = container.get<DeliveryRepository>('DeliveryRepository');
        const countersMediator = container.get<CountersMediator>('CountersMediator');

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

        const local1 = await ustate.getUserDialogState(ctx, USER1_ID, CHAT1_ID);
        const local2 = await ustate.getUserDialogState(ctx, USER2_ID, CHAT1_ID);

        const dialogs1 = await Store.UserDialog.user.findAll(ctx, USER2_ID);

        const mid1 = await messagingMediator.sendMessage(ctx, USER1_ID, CHAT1_ID, { message: 'test' });
        const mid2 = await messagingMediator.sendMessage(ctx, USER1_ID, CHAT1_ID, { message: 'test 2' });

        const mid3 = await messagingMediator.sendMessage(ctx, USER2_ID, CHAT1_ID, { message: 'test 3' });
        const mid4 = await messagingMediator.sendMessage(ctx, USER2_ID, CHAT1_ID, { message: 'test 4' });

        const ctx2 = createNamedContext('test-2');

        const messages = await Promise.all([mid1, mid2, mid3, mid4].map(mid => Store.Message.findById(ctx2, mid.mid!)));

        const __delivered = await Promise.all(
            messages.map(async m => {
                const message = (await Store.Message.findById(ctx2, m!.id))!;
                const members = await roomMediator.findConversationMembers(ctx2, message.cid);

                console.log({ message: message.text });
                console.log({ members });

                return Promise.all(
                    members.map(async uid => {
                        await countersMediator.onMessageReceived(ctx2, uid, m!);
                        await deliveryRepo.deliverMessageToUser(ctx2, uid, m!);

                        return;
                    })
                );
            })
        );

        const ctx3 = createNamedContext('test-3');

        const local3 = await ustate.getUserDialogState(ctx3, USER1_ID, CHAT1_ID);
        const local4 = await ustate.getUserDialogState(ctx3, USER2_ID, CHAT1_ID);

        const dialogs2 = await Store.UserDialog.user.findAll(ctx3, USER2_ID);
        const dialogs3 = await Store.UserDialog.user.findAll(ctx3, USER1_ID);

        // why dialog3 and dialogs2 are empty?

        console.log({ dialogs2: dialogs2.map(a => a.unread), dialogs3: dialogs3.map(a => a.unread) });

        // why unread: 0 ?
        // @ts-ignore
        console.log({ local4: local4._rawValue });

        // why unread: 0 ?
        // @ts-ignore
        console.log({ local3: local3._rawValue });
    });
});
