import { testEnvironmentEnd, testEnvironmentStart } from 'openland-modules/testEnvironment';
import { container } from 'openland-modules/Modules.container';
import { RoomMediator } from './RoomMediator';
import { FDB } from 'openland-module-db/FDB';
import { loadMessagingTestModule } from 'openland-module-messaging/Messaging.container.test';

describe('RoomMediator', () => {
    beforeAll(async () => {
        await testEnvironmentStart('room-mediator');
        loadMessagingTestModule();
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
});