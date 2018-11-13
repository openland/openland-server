import { testEnvironmentEnd, testEnvironmentStart } from 'openland-modules/testEnvironment';
import { container } from 'openland-modules/Modules.container';
import { FDB } from 'openland-module-db/FDB';
import { loadMessagingTestModule } from 'openland-module-messaging/Messaging.container.test';
import { UsersModule } from 'openland-module-users/UsersModule';
import { RoomMediator } from 'openland-module-messaging/mediators/RoomMediator';

describe('RoomMediator', () => {
    beforeAll(async () => {
        await testEnvironmentStart('room-mediator');
        loadMessagingTestModule();
        container.bind(UsersModule).toSelf().inSingletonScope();
    });
    afterAll(() => {
        testEnvironmentEnd();
    });

    it('should create room', async () => {
        let mediator = container.get<RoomMediator>('RoomMediator');
        let USER_ID = 2;
        let room = await mediator.createRoom('public', 1, USER_ID, [], { title: 'Room' });
        expect(room.kind).toEqual('room');
        let profile = (await FDB.ConversationRoom.findById(room.id))!;
        expect(profile).not.toBeNull();
        expect(profile).not.toBeUndefined();
        expect(profile.kind).toEqual('public');
        let messages = await FDB.Message.allFromChat(room.id);
        expect(messages.length).toBe(1);
        expect(messages[0].uid).toBe(USER_ID);
        expect(messages[0].cid).toBe(room.id);
        expect(messages[0].text).toBe('Room created');
    });

    it('should be able to join room', async () => {
        let mediator = container.get<RoomMediator>('RoomMediator');
        let users = container.get<UsersModule>(UsersModule);
        let USER_ID = (await users.createUser('user111', 'email111')).id;
        let USER2_ID = (await users.createUser('user112', 'email112')).id;
        await users.createUserProfile(USER_ID, { firstName: 'User Name' });
        await users.createUserProfile(USER2_ID, { firstName: 'User Name' });
        let room = await mediator.createRoom('public', 1, USER_ID, [], { title: 'Room' });
        await mediator.joinRoom(room.id, USER2_ID);
        let messages = await FDB.Message.allFromChat(room.id);
        expect(messages.length).toBe(2);
        expect(messages[0].uid).toBe(USER_ID);
        expect(messages[1].uid).toBe(USER2_ID);
        let members = await FDB.RoomParticipant.allFromActive(room.id);
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
});