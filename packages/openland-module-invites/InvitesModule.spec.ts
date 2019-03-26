import { testEnvironmentEnd, testEnvironmentStart } from 'openland-modules/testEnvironment';
import { container } from 'openland-modules/Modules.container';
import { FDB } from 'openland-module-db/FDB';
import { loadMessagingTestModule } from 'openland-module-messaging/Messaging.container.test';
import { UsersModule } from 'openland-module-users/UsersModule';
import { RoomMediator } from 'openland-module-messaging/mediators/RoomMediator';
import { createEmptyContext } from 'openland-utils/Context';
import { UserRepository } from 'openland-module-users/repositories/UserRepository';
import { OrganizationModule } from 'openland-module-organization/OrganizationModule';
import { OrganizationRepository } from 'openland-module-organization/repositories/OrganizationRepository';
import { Modules } from '../openland-modules/Modules';
import { SuperModule } from 'openland-module-super/SuperModule';

describe('RoomMediator', () => {
    beforeAll(async () => {
        await testEnvironmentStart('room-mediator');
        loadMessagingTestModule();
        container.bind(UsersModule).toSelf().inSingletonScope();
        container.bind('UserRepository').to(UserRepository).inSingletonScope();
        container.bind(OrganizationModule).toSelf().inSingletonScope();
        container.bind(SuperModule).toSelf().inSingletonScope();
        container.bind('OrganizationRepository').to(OrganizationRepository).inSingletonScope();
    });
    afterAll(() => {
        testEnvironmentEnd();
    });

    it('should create room', async () => {
        let ctx = createEmptyContext();
        let mediator = container.get<RoomMediator>('RoomMediator');
        let users = container.get<UsersModule>(UsersModule);
        let USER_ID = (await users.createUser(ctx, 'user' + Math.random(), 'email' + Math.random())).id;
        await users.createUserProfile(ctx, USER_ID, { firstName: 'User Name' + Math.random() });
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
        let userName = await Modules.Users.getUserFullName(ctx, USER_ID);
        expect(messages[0].text).toBe(`@${userName} created the group Room`);
    });

    it('should be able to join room', async () => {
        let ctx = createEmptyContext();
        let mediator = container.get<RoomMediator>('RoomMediator');
        let users = container.get<UsersModule>(UsersModule);
        let USER_ID = (await users.createUser(ctx, 'user111', 'email111')).id;
        let USER2_ID = (await users.createUser(ctx, 'user112', 'email112')).id;
        await users.createUserProfile(ctx, USER_ID, { firstName: 'User Name' });
        await users.createUserProfile(ctx, USER2_ID, { firstName: 'User Name' });
        let room = await mediator.createRoom(ctx, 'group', 1, USER_ID, [], { title: 'Room' });
        await expect(mediator.joinRoom(ctx, room.id, USER2_ID, true)).rejects.toThrowError('You can\'t join non-public room');
        let members = await FDB.RoomParticipant.allFromActive(ctx, room.id);
        expect(members.length).toBe(1);
        for (let m of members) {
            if (m.uid === USER_ID) {
                expect(m.status).toBe('joined');
                expect(m.role).toEqual('owner');
                expect(m.invitedBy).toBe(USER_ID);
            } else {
                expect(m.status).toBe('requested');
                expect(m.role).toEqual('member');
                expect(m.invitedBy).toBe(USER2_ID);
            }
        }
        await mediator.inviteToRoom(ctx, room.id, USER_ID, [USER2_ID]);
        let messages = await FDB.Message.allFromChat(ctx, room.id);
        expect(messages.length).toBe(2);
        expect(messages[0].uid).toBe(USER_ID);
        expect(messages[1].uid).toBe(USER_ID);
        members = await FDB.RoomParticipant.allFromActive(ctx, room.id);
        expect(members.length).toBe(2);
        for (let m of members) {
            if (m.uid === USER2_ID) {
                expect(m.status).toBe('joined');
                expect(m.invitedBy).toBe(USER_ID);
            }
        }

    });
});