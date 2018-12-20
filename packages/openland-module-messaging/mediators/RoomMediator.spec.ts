import { testEnvironmentEnd, testEnvironmentStart } from 'openland-modules/testEnvironment';
import { container } from 'openland-modules/Modules.container';
import { RoomMediator } from './RoomMediator';
import { FDB } from 'openland-module-db/FDB';
import { loadMessagingTestModule } from 'openland-module-messaging/Messaging.container.test';
import { UsersModule } from 'openland-module-users/UsersModule';
import { createEmptyContext } from 'openland-utils/Context';
import { SuperModule } from '../../openland-module-super/SuperModule';

describe('RoomMediator', () => {
    beforeAll(async () => {
        await testEnvironmentStart('room-mediator');
        loadMessagingTestModule();
        container.bind(UsersModule).toSelf().inSingletonScope();
        container.bind(SuperModule).toSelf().inSingletonScope();

    });
    afterAll(() => {
        testEnvironmentEnd();
    });

    it('should create room', async () => {
        let ctx = createEmptyContext();
        let mediator = container.get<RoomMediator>('RoomMediator');
        let USER_ID = 2;
        let room = await mediator.createRoom(ctx, 'public', 1, USER_ID, [], { title: 'Room' });
        expect(room.kind).toEqual('room');
        let profile = (await FDB.ConversationRoom.findById(ctx, room.id))!;
        expect(profile).not.toBeNull();
        expect(profile).not.toBeUndefined();
        expect(profile.kind).toEqual('public');
        let messages = await FDB.Message.allFromChat(ctx, room.id);
        expect(messages.length).toBe(1);
        expect(messages[0].uid).toBe(USER_ID);
        expect(messages[0].cid).toBe(room.id);
        expect(messages[0].text).toBe('Room created');
    });

    it('should be able to join room', async () => {
        let ctx = createEmptyContext();
        let mediator = container.get<RoomMediator>('RoomMediator');
        let users = container.get<UsersModule>(UsersModule);
        await users.createUser(ctx, 'user110', 'email1110');
        let USER_ID = (await users.createUser(ctx, 'user111', 'email111')).id;
        let USER2_ID = (await users.createUser(ctx, 'user112', 'email112')).id;
        await users.createUserProfile(ctx, USER_ID, { firstName: 'User Name' });
        await users.createUserProfile(ctx, USER2_ID, { firstName: 'User Name' });
        let room = await mediator.createRoom(ctx, 'public', 1, USER_ID, [], { title: 'Room' });
        await mediator.joinRoom(ctx, room.id, USER2_ID);
        let messages = await FDB.Message.allFromChat(ctx, room.id);
        expect(messages.length).toBe(2);
        expect(messages[0].uid).toBe(USER_ID);
        expect(messages[1].uid).toBe(USER2_ID);
        let members = await FDB.RoomParticipant.allFromActive(ctx, room.id);
        expect(members.length).toBe(2);
        for (let m of members) {
            expect(m.status).toBe('joined');
            if (m.uid === USER_ID) {
                expect(m.role).toEqual('owner');
                expect(m.invitedBy).toBe(USER_ID);
            } else {
                expect(m.role).toEqual('member');
                expect(m.invitedBy).toBe(USER2_ID);
            }
        }
    });

    it('should be able to manage join requests', async () => {
        let ctx = createEmptyContext();
        let mediator = container.get<RoomMediator>('RoomMediator');
        let users = container.get<UsersModule>(UsersModule);
        await users.createUser(ctx, 'user3110', 'email1110');
        let USER_ID = (await users.createUser(ctx, 'user3111', 'email111')).id;
        let USER2_ID = (await users.createUser(ctx, 'user3112', 'email112')).id;
        let USER3_ID = (await users.createUser(ctx, 'user3113', 'email113')).id;
        await users.createUserProfile(ctx, USER_ID, { firstName: 'User Name' });
        await users.createUserProfile(ctx, USER2_ID, { firstName: 'User Name' });
        await users.createUserProfile(ctx, USER3_ID, { firstName: 'User Name' });
        let room = await mediator.createRoom(ctx, 'group', 1, USER_ID, [], { title: 'Room' });
        await mediator.joinRoom(ctx, room.id, USER2_ID, true);
        await mediator.joinRoom(ctx, room.id, USER3_ID, true);
        let members = await FDB.RoomParticipant.allFromRequests(ctx, room.id);
        expect(members.length).toBe(2);
        for (let m of members) {
            if (m.uid === USER2_ID) {
                expect(m.status).toEqual('requested');
            } else if (m.uid === USER3_ID) {
                expect(m.status).toBe('requested');
            }
        }
        await mediator.declineJoinRoomRequest(ctx, room.id, USER_ID, USER2_ID);
        await mediator.inviteToRoom(ctx, room.id, USER_ID, [USER3_ID]);
        let messages = await FDB.Message.allFromChat(ctx, room.id);
        expect(messages.length).toBe(2);
        expect(messages[0].uid).toBe(USER_ID);
        expect(messages[1].uid).toBe(USER_ID);
        members = await FDB.RoomParticipant.allFromActive(ctx, room.id);
        expect(members.length).toBe(2);
        for (let m of members) {
            expect(m.status).toEqual('joined');
        }
    });

    it('should be able to kick from room', async () => {
        let ctx = createEmptyContext();
        let mediator = container.get<RoomMediator>('RoomMediator');
        let users = container.get<UsersModule>(UsersModule);
        let USER_ID = (await users.createUser(ctx, 'user2111', 'email111')).id;
        let USER2_ID = (await users.createUser(ctx, 'user2112', 'email112')).id;
        await users.createUserProfile(ctx, USER_ID, { firstName: 'User Name' });
        await users.createUserProfile(ctx, USER2_ID, { firstName: 'User Name 2' });
        let room = await mediator.createRoom(ctx, 'public', 1, USER_ID, [], { title: 'Room' });
        await mediator.joinRoom(ctx, room.id, USER2_ID);
        let messages = await FDB.Message.allFromChat(ctx, room.id);
        expect(messages.length).toBe(2);
        expect(messages[0].uid).toBe(USER_ID);
        expect(messages[1].uid).toBe(USER2_ID);
        let members = await FDB.RoomParticipant.allFromActive(ctx, room.id);
        expect(members.length).toBe(2);
        for (let m of members) {
            expect(m.status).toBe('joined');
            if (m.uid === USER_ID) {
                expect(m.role).toEqual('owner');
                expect(m.invitedBy).toBe(USER_ID);
            } else {
                expect(m.role).toEqual('member');
                expect(m.invitedBy).toBe(USER2_ID);
            }
        }

        await mediator.kickFromRoom(ctx, room.id, USER_ID, USER2_ID);
        members = await FDB.RoomParticipant.allFromActive(ctx, room.id);
        expect(members.length).toBe(1);
        expect(members[0].uid).toBe(USER_ID);
    });
});