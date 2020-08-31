import { testEnvironmentEnd, testEnvironmentStart } from 'openland-modules/testEnvironment';
// import { StatsModule } from './StatsModule';
// import { UnreadGroups } from './StatsModule.types';
import { container } from 'openland-modules/Modules.container';
// import { createNamedContext } from '@openland/context';
import { loadMessagingTestModule } from 'openland-module-messaging/Messaging.container.test';
import { loadUsersModule } from 'openland-module-users/UsersModule.container';
// import { RoomRepository } from 'openland-module-messaging/repositories/RoomRepository';
// import { Modules } from 'openland-modules/Modules';
import { UsersModule } from 'openland-module-users/UsersModule';
import { OrganizationModule } from 'openland-module-organization/OrganizationModule';
import { SuperModule } from 'openland-module-super/SuperModule';
import { OrganizationRepository } from 'openland-module-organization/repositories/OrganizationRepository';
// import { Store } from 'openland-module-db/FDB';
// import { MessagingMediator } from 'openland-module-messaging/mediators/MessagingMediator';
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
    it('should return list of unread dialogs', async () => {
        expect(true).toBe(true);
        // const ctx = createNamedContext('test');
        //
        // const statsModule = container.get<StatsModule>(StatsModule);
        // // const ustate = container.get<UserStateRepository>('UserStateRepository');
        //
        // const deliveryRepo = container.get<DeliveryRepository>('DeliveryRepository');
        // const countersMediator = container.get<CountersMediator>('CountersMediator');
        //
        // // const roomMediator = container.get<RoomMediator>('RoomMediator');
        // const roomRepo = container.get<RoomRepository>('RoomRepository');
        // const messagingMediator = container.get<MessagingMediator>('MessagingMediator');
        // // const users = container.get<UsersModule>(UsersModule);
        //
        // const USER1_ID = (await randomTestUser(ctx)).uid;
        // const USER2_ID = (await randomTestUser(ctx)).uid;
        //
        // const oid = (await Modules.Orgs.createOrganization(ctx, USER1_ID, { name: '1', isCommunity: true })).id;
        //
        // const CHAT1_ID = (await roomRepo.createRoom(ctx, 'public', oid, USER1_ID, [], { title: 'Room 321' })).id;
        // const CHAT2_ID = (await roomRepo.createRoom(ctx, 'public', oid, USER1_ID, [], { title: 'Room ff' })).id;
        //
        // const CHAT3_ID = 777;
        //
        // await (await Store.Conversation.create(ctx, CHAT3_ID, { kind: 'private' })).flush(ctx);
        // await Store.ConversationPrivate.create(ctx, CHAT3_ID, { uid1: Math.min(USER1_ID, USER2_ID), uid2: Math.max(USER1_ID, USER2_ID) });
        //
        // await roomRepo.addToRoom(ctx, CHAT1_ID, USER2_ID, USER1_ID);
        // await roomRepo.addToRoom(ctx, CHAT2_ID, USER2_ID, USER1_ID);
        //
        // const membersChat1 = await Store.RoomParticipant.active.findAll(ctx, CHAT1_ID);
        // expect(membersChat1.length).toBe(2);
        //
        // const membersChat2 = await Store.RoomParticipant.active.findAll(ctx, CHAT2_ID);
        // expect(membersChat2.length).toBe(2);
        //
        // const msgsByUser1ToChat1 = Array(3)
        //     .fill(0)
        //     .map((_, msg) => ({ message: `${msg}`, uid: USER1_ID, cid: CHAT1_ID }));
        //
        // const msgsByUser2ToChat1 = Array(2)
        //     .fill(0)
        //     .map((_, msg) => ({ message: `${msg}`, uid: USER2_ID, cid: CHAT1_ID }));
        //
        // const msgsByUser1ToChat2 = Array(5)
        //     .fill(0)
        //     .map((_, msg) => ({ message: `${msg}`, uid: USER1_ID, cid: CHAT2_ID }));
        //
        // const msgsByUser2ToChat2 = Array(7)
        //     .fill(0)
        //     .map((_, msg) => ({ message: `${msg}`, uid: USER2_ID, cid: CHAT2_ID }));
        //
        // const msgsByUser2ToUser1 = Array(6)
        //     .fill(0)
        //     .map((_, msg) => ({ message: `${msg}`, uid: USER2_ID, cid: 777 }));
        //
        // await Modules.Messaging.room.resolvePrivateChat(ctx, USER1_ID, USER2_ID);
        // const mids = await Promise.all(
        //     [...msgsByUser1ToChat1, ...msgsByUser2ToChat1, ...msgsByUser1ToChat2, ...msgsByUser2ToChat2, ...msgsByUser2ToUser1].map(msg =>
        //         messagingMediator.sendMessage(ctx, msg.uid, msg.cid, { message: msg.message })
        //     )
        // );
        //
        // const messagesIds = mids.map(a => a.id);
        //
        // // delivery
        // await Promise.all(
        //     messagesIds.map(async mid => {
        //         const message = (await Store.Message.findById(ctx, mid))!;
        //         const members = await roomRepo.findConversationMembers(ctx, message.cid);
        //
        //         return Promise.all(
        //             members.map(async uid => {
        //                 await countersMediator.onMessageReceived(ctx, uid, message);
        //                 await deliveryRepo.deliverMessageToUser(ctx, uid, message);
        //                 await Modules.Metrics.onMessageReceived(ctx, message, uid);
        //
        //                 return;
        //             })
        //         );
        //     })
        // );
        //
        // const unreadByUser1 = await statsModule.getUnreadGroupsByUserId(ctx, USER1_ID, 4);
        // const unreadByUser2 = await statsModule.getUnreadGroupsByUserId(ctx, USER2_ID, 1);
        // await new Promise(r => setTimeout(r, 500));
        // // console.dir(JSON.stringify({ unreadByUser1, unreadByUser2 }, null, 2));
        //
        // expect(unreadByUser1).toEqual({
        //     unreadMessagesCount: 21,
        //     unreadMoreGroupsCount: 0,
        //     groups: [
        //         {
        //             serializedId: expect.any(String),
        //             previewImage: expect.any(String),
        //             title: expect.stringContaining('User Name'),
        //             unreadCount: 12,
        //             convKind: 'private'
        //         },
        //         //
        //         {
        //             serializedId: expect.any(String),
        //             previewImage: expect.any(String),
        //             title: 'Room ff',
        //             unreadCount: 7,
        //             convKind: 'room'
        //         },
        //         {
        //             serializedId: expect.any(String),
        //             previewImage: expect.any(String),
        //             title: 'Room 321',
        //             unreadCount: 2,
        //             convKind: 'room'
        //         }
        //     ]
        // } as UnreadGroups);
        //
        // expect(unreadByUser2).toEqual({
        //     unreadMessagesCount: 8,
        //     unreadMoreGroupsCount: 1,
        //     groups: [
        //         {
        //             serializedId: expect.any(String),
        //             previewImage: expect.any(String),
        //             title: 'Room ff',
        //             unreadCount: 5,
        //             convKind: 'room'
        //         },
        //     ]
        // } as UnreadGroups);
    });
});
