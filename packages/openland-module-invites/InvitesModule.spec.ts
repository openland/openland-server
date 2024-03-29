import { randomTestUser, testEnvironmentEnd, testEnvironmentStart } from 'openland-modules/testEnvironment';
import { container } from 'openland-modules/Modules.container';
import { Store } from 'openland-module-db/FDB';
import { loadMessagingTestModule } from 'openland-module-messaging/Messaging.container.test';
import { UsersModule } from 'openland-module-users/UsersModule';
import { RoomMediator } from 'openland-module-messaging/mediators/RoomMediator';
import { OrganizationModule } from 'openland-module-organization/OrganizationModule';
import { OrganizationRepository } from 'openland-module-organization/repositories/OrganizationRepository';
import { Modules } from '../openland-modules/Modules';
import { SuperModule } from 'openland-module-super/SuperModule';
import { createNamedContext } from '@openland/context';
import { loadUsersModule } from '../openland-module-users/UsersModule.container';
import { inReadOnlyTx } from '@openland/foundationdb';

let rootCtx = createNamedContext('test');

describe('InvitesModule', () => {
    beforeAll(async () => {
        await testEnvironmentStart('room-mediator');
        loadMessagingTestModule();
        container.bind(UsersModule).toSelf().inSingletonScope();
        loadUsersModule();
        container.bind(OrganizationModule).toSelf().inSingletonScope();
        container.bind(SuperModule).toSelf().inSingletonScope();
        container.bind('OrganizationRepository').to(OrganizationRepository).inSingletonScope();
    });
    afterAll(async () => {
        await testEnvironmentEnd();
    });

    it('should create room', async () => {
        let mediator = container.get<RoomMediator>('RoomMediator');
        let users = container.get<UsersModule>(UsersModule);
        let USER_ID = (await users.createUser(rootCtx, { email: 'email' + Math.random() })).id;
        await users.createUserProfile(rootCtx, USER_ID, { firstName: 'User Name' + Math.random() });
        await Modules.Events.mediator.prepareUser(rootCtx, USER_ID);
        let oid = (await Modules.Orgs.createOrganization(rootCtx, USER_ID, { name: '1' })).id;
        let room = await mediator.createRoom(rootCtx, 'public', oid, USER_ID, [], { title: 'Room' });
        expect(room.kind).toEqual('room');
        let profile = (await inReadOnlyTx(rootCtx, async (ctx) => await Store.ConversationRoom.findById(ctx, room.id)))!;
        expect(profile).not.toBeNull();
        expect(profile).not.toBeUndefined();
        expect(profile.kind).toEqual('public');
        let messages = await inReadOnlyTx(rootCtx, async (ctx) => await Store.Message.chat.findAll(ctx, room.id));
        expect(messages.length).toBe(1);
        expect(messages[0].uid).toBe(USER_ID);
        expect(messages[0].cid).toBe(room.id);
        let userName = await inReadOnlyTx(rootCtx, async (ctx) => await Modules.Users.getUserFullName(ctx, USER_ID));
        expect(messages[0].text).toBe(`${userName} created the\u00A0group Room`);
    });

    it('should be able to join room', async () => {
        let mediator = container.get<RoomMediator>('RoomMediator');
        let users = container.get<UsersModule>(UsersModule);
        let USER_ID = (await randomTestUser(rootCtx)).uid;
        let USER2_ID = (await users.createUser(rootCtx, { email: 'email112' })).id;
        await users.createUserProfile(rootCtx, USER2_ID, { firstName: 'User Name' });
        await Modules.Events.mediator.prepareUser(rootCtx, USER_ID);
        await Modules.Events.mediator.prepareUser(rootCtx, USER2_ID);
        let oid = (await Modules.Orgs.createOrganization(rootCtx, USER_ID, { name: '1' })).id;
        let room = await mediator.createRoom(rootCtx, 'group', oid, USER_ID, [], { title: 'Room' });
        await expect(mediator.joinRoom(rootCtx, room.id, USER2_ID, false)).rejects.toThrowError('You can\'t join non-public room');
        let members = await inReadOnlyTx(rootCtx, async (ctx) => await Store.RoomParticipant.active.findAll(ctx, room.id));
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
        await mediator.inviteToRoom(rootCtx, room.id, USER_ID, [USER2_ID]);
        let messages = await inReadOnlyTx(rootCtx, async (ctx) => await Store.Message.chat.findAll(ctx, room.id));
        expect(messages.length).toBe(2);
        expect(messages[0].uid).toBe(USER_ID);
        expect(messages[1].uid).toBe(USER_ID);
        members = await inReadOnlyTx(rootCtx, async (ctx) => await Store.RoomParticipant.active.findAll(ctx, room.id));
        expect(members.length).toBe(2);
        for (let m of members) {
            if (m.uid === USER2_ID) {
                expect(m.status).toBe('joined');
                expect(m.invitedBy).toBe(USER_ID);
            }
        }

    });
});
