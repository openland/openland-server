import { randomTestUser, testEnvironmentEnd, testEnvironmentStart } from 'openland-modules/testEnvironment';
import { container } from 'openland-modules/Modules.container';
import { RoomMediator } from './RoomMediator';
import { Store } from 'openland-module-db/FDB';
import { loadMessagingTestModule } from 'openland-module-messaging/Messaging.container.test';
import { UsersModule } from 'openland-module-users/UsersModule';
import { SuperModule } from '../../openland-module-super/SuperModule';
import { OrganizationRepository } from '../../openland-module-organization/repositories/OrganizationRepository';
import { OrganizationModule } from '../../openland-module-organization/OrganizationModule';
import { Modules } from '../../openland-modules/Modules';
import { HooksModule } from '../../openland-module-hooks/HooksModule';
import { Context, createNamedContext } from '@openland/context';
import { loadUsersModule } from '../../openland-module-users/UsersModule.container';

describe('RoomMediator', () => {
    beforeAll(async () => {
        await testEnvironmentStart('room-mediator');
        loadMessagingTestModule();
        container.bind(UsersModule).toSelf().inSingletonScope();
        loadUsersModule();
        container.bind(SuperModule).toSelf().inSingletonScope();
        container.bind(HooksModule).toSelf().inSingletonScope();
        container.bind('OrganizationRepository').to(OrganizationRepository).inSingletonScope();
        container.bind(OrganizationModule).toSelf().inSingletonScope();
    });
    afterAll( async () => {
      await  testEnvironmentEnd();
    });

    async function randomUser(ctx: Context) {
        let users = container.get<UsersModule>(UsersModule);
        let uid = (await users.createUser(ctx, {email: 'email' + Math.random()})).id;
        await users.createUserProfile(ctx, uid, { firstName: 'User Name' + Math.random() });
        return uid;
    }

    it('should create room', async () => {
        let ctx = createNamedContext('test');
        let mediator = container.get<RoomMediator>('RoomMediator');
        let USER_ID = (await randomTestUser(ctx)).uid;
        let org = await Modules.Orgs.createOrganization(ctx, USER_ID, { name: '1' });
        let room = await mediator.createRoom(ctx, 'public', org.id, USER_ID, [], { title: 'Room' });
        expect(room.kind).toEqual('room');
        let profile = (await Store.ConversationRoom.findById(ctx, room.id))!;
        expect(profile).not.toBeNull();
        expect(profile).not.toBeUndefined();
        expect(profile.kind).toEqual('public');
        let messages = await Store.Message.chat.findAll(ctx, room.id);
        expect(messages.length).toBe(1);
        expect(messages[0].uid).toBe(USER_ID);
        expect(messages[0].cid).toBe(room.id);
        let userName = await Modules.Users.getUserFullName(ctx, USER_ID);
        expect(messages[0].text).toBe(`${userName} created the\u00A0group Room`);
    });

    it('should be able to join room', async () => {
        let ctx = createNamedContext('test');
        let mediator = container.get<RoomMediator>('RoomMediator');
        let USER_ID = await randomUser(ctx);
        let USER2_ID = await randomUser(ctx);
        let orgs = await container.get<OrganizationModule>(OrganizationModule);
        let org = await orgs.createOrganization(ctx, USER_ID, { name: 'Org', isCommunity: true });
        let room = await mediator.createRoom(ctx, 'public', org.id, USER_ID, [], { title: 'Room' });
        await mediator.joinRoom(ctx, room.id, USER2_ID);
        let members = await Store.RoomParticipant.active.findAll(ctx, room.id);
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

    it('should join community on room join', async () => {
        let ctx = createNamedContext('test');
        let mediator = container.get<RoomMediator>('RoomMediator');
        let orgs = await container.get<OrganizationModule>(OrganizationModule);
        let USER_ID = await randomUser(ctx);
        let USER2_ID = await randomUser(ctx);
        await orgs.createOrganization(ctx, USER_ID, { name: 'Org', isCommunity: false });
        await orgs.createOrganization(ctx, USER2_ID, { name: 'Org', isCommunity: false });

        let org = await orgs.createOrganization(ctx, USER_ID, { name: 'Org', isCommunity: true });
        await orgs.activateOrganization(ctx, org.id, true);

        let room = await mediator.createRoom(ctx, 'public', org.id, USER_ID, [], { title: 'Room' });
        await mediator.joinRoom(ctx, room.id, USER2_ID);

        expect(await orgs.isUserMember(ctx, USER2_ID, org.id)).toEqual(true);
    });

    it('should not join organization on room join', async () => {
        let ctx = createNamedContext('test');
        let mediator = container.get<RoomMediator>('RoomMediator');
        let USER_ID = await randomUser(ctx);
        let USER2_ID = await randomUser(ctx);

        let orgs = await container.get<OrganizationModule>(OrganizationModule);

        let org = await orgs.createOrganization(ctx, USER_ID, { name: 'Org', isCommunity: false });
        await orgs.activateOrganization(ctx, org.id, true);

        let room = await mediator.createRoom(ctx, 'public', org.id, USER_ID, [], { title: 'Room' });
        let res = mediator.joinRoom(ctx, room.id, USER2_ID);
        await expect(res).rejects.toThrowError('You can\'t join non-public room');

        expect(await orgs.isUserMember(ctx, USER2_ID, org.id)).toEqual(false);
    });

    // it('should be able to manage join requests', async () => {
    //     let ctx = createEmptyContext();
    //     let mediator = container.get<RoomMediator>('RoomMediator');
    //     await users.createUser(ctx, 'user3110', 'email111033');
    //     let USER_ID = (await users.createUser(ctx, 'user3111', 'email1111111')).id;
    //     let USER2_ID = (await users.createUser(ctx, 'user3112', 'email112111')).id;
    //     let USER3_ID = (await users.createUser(ctx, 'user3113', 'email113111')).id;
    //     await users.createUserProfile(ctx, USER_ID, { firstName: 'User Name' });
    //     await users.createUserProfile(ctx, USER2_ID, { firstName: 'User Name' });
    //     await users.createUserProfile(ctx, USER3_ID, { firstName: 'User Name' });
    //     let orgs = await container.get<OrganizationModule>(OrganizationModule);
    //     let org = await orgs.createOrganization(ctx, USER_ID, { name: 'Org', isCommunity: false });
    //     let room = await mediator.createRoom(ctx, 'public', org.id, USER_ID, [], { title: 'Room' });
    //     await mediator.joinRoom(ctx, room.id, USER2_ID, true);
    //     await mediator.joinRoom(ctx, room.id, USER3_ID, true);
    //     let members = await FDB.RoomParticipant.allFromRequests(ctx, room.id);
    //     expect(members.length).toBe(2);
    //     for (let m of members) {
    //         if (m.uid === USER2_ID) {
    //             expect(m.status).toEqual('requested');
    //         } else if (m.uid === USER3_ID) {
    //             expect(m.status).toBe('requested');
    //         }
    //     }
    //     await mediator.declineJoinRoomRequest(ctx, room.id, USER_ID, USER2_ID);
    //     await mediator.inviteToRoom(ctx, room.id, USER_ID, [USER3_ID]);
    //     let messages = await FDB.Message.allFromChat(ctx, room.id);
    //     expect(messages.length).toBe(2);
    //     expect(messages[0].uid).toBe(USER_ID);
    //     expect(messages[1].uid).toBe(USER_ID);
    //     members = await FDB.RoomParticipant.allFromActive(ctx, room.id);
    //     expect(members.length).toBe(2);
    //     for (let m of members) {
    //         expect(m.status).toEqual('joined');
    //     }
    // });

    it('should be able to join organization chat if member', async () => {
        let ctx = createNamedContext('test');
        let mediator = container.get<RoomMediator>('RoomMediator');
        let USER_ID = await randomUser(ctx);
        let USER2_ID = await randomUser(ctx);
        let USER3_ID = await randomUser(ctx);
        let orgs = await container.get<OrganizationModule>(OrganizationModule);
        let org = await orgs.createOrganization(ctx, USER_ID, { name: 'Org', isCommunity: false });
        await orgs.addUserToOrganization(ctx, USER2_ID, org.id, USER_ID);

        let room = await mediator.createRoom(ctx, 'public', org.id, USER_ID, [], { title: 'Room' });
        await mediator.joinRoom(ctx, room.id, USER2_ID, true);
        let res = mediator.joinRoom(ctx, room.id, USER3_ID, true);
        await expect(res).rejects.toThrowError('You can\'t join non-public room');
        let members = await Store.RoomParticipant.active.findAll(ctx, room.id);
        expect(members.length).toBe(2);
        for (let m of members) {
            if (m.uid === USER_ID) {
                expect(m.status).toEqual('joined');
            } else if (m.uid === USER2_ID) {
                expect(m.status).toBe('joined');
            }
        }
    });

    it('should be able to join community chat regardless of membership', async () => {
        let ctx = createNamedContext('test');
        let mediator = container.get<RoomMediator>('RoomMediator');
        let USER_ID = await randomUser(ctx);
        let USER2_ID = await randomUser(ctx);
        let USER3_ID = await randomUser(ctx);
        let orgs = await container.get<OrganizationModule>(OrganizationModule);
        let org = await orgs.createOrganization(ctx, USER_ID, { name: 'Org', isCommunity: true });
        await orgs.addUserToOrganization(ctx, USER2_ID, org.id, USER_ID);

        let room = await mediator.createRoom(ctx, 'public', org.id, USER_ID, [], { title: 'Room' });
        await mediator.joinRoom(ctx, room.id, USER2_ID, true);
        await mediator.joinRoom(ctx, room.id, USER3_ID, true);
        let members = await Store.RoomParticipant.active.findAll(ctx, room.id);
        expect(members.length).toBe(3);
        for (let m of members) {
            if (m.uid === USER_ID) {
                expect(m.status).toEqual('joined');
            } else if (m.uid === USER2_ID) {
                expect(m.status).toBe('joined');
            } else if (m.uid === USER3_ID) {
                expect(m.status).toBe('joined');
            }
        }
    });

    it('should not be able to join secret chat', async () => {
        let ctx = createNamedContext('test');
        let mediator = container.get<RoomMediator>('RoomMediator');
        let USER_ID = await randomUser(ctx);
        let USER2_ID = await randomUser(ctx);
        let USER3_ID = await randomUser(ctx);
        let orgs = await container.get<OrganizationModule>(OrganizationModule);
        let org = await orgs.createOrganization(ctx, USER_ID, { name: 'Org', isCommunity: false });
        await orgs.addUserToOrganization(ctx, USER2_ID, org.id, USER_ID);

        let room = await mediator.createRoom(ctx, 'group', org.id, USER_ID, [], { title: 'Room' });
        await expect(mediator.joinRoom(ctx, room.id, USER2_ID, true)).rejects.toThrowError('You can\'t join non-public room');
        await expect(mediator.joinRoom(ctx, room.id, USER3_ID, true)).rejects.toThrowError('You can\'t join non-public room');
        let members = await Store.RoomParticipant.active.findAll(ctx, room.id);
        expect(members.length).toBe(1);
        for (let m of members) {
            if (m.uid === USER_ID) {
                expect(m.status).toEqual('joined');
            }
        }
    });

    it('should be able to join secret chat if was invited', async () => {
        let ctx = createNamedContext('test');
        let mediator = container.get<RoomMediator>('RoomMediator');
        let USER_ID = await randomUser(ctx);
        let USER2_ID = await randomUser(ctx);
        let USER3_ID = await randomUser(ctx);
        let orgs = await container.get<OrganizationModule>(OrganizationModule);
        let org = await orgs.createOrganization(ctx, USER_ID, { name: 'Org', isCommunity: false });
        await orgs.addUserToOrganization(ctx, USER2_ID, org.id, USER_ID);

        let room = await mediator.createRoom(ctx, 'group', org.id, USER_ID, [], { title: 'Room' });
        await expect(mediator.joinRoom(ctx, room.id, USER2_ID, true)).rejects.toThrowError('You can\'t join non-public room');
        await mediator.inviteToRoom(ctx, room.id, USER_ID, [ USER3_ID ]);
        await mediator.joinRoom(ctx, room.id, USER3_ID, false, true);
        let members = await Store.RoomParticipant.active.findAll(ctx, room.id);
        expect(members.length).toBe(2);
        for (let m of members) {
            if (m.uid === USER_ID) {
                expect(m.status).toEqual('joined');
            } else if (m.uid === USER3_ID) {
                expect(m.status).toEqual('joined');
            }
        }
    });

    it('should be able to kick from room', async () => {
        let ctx = createNamedContext('test');
        let mediator = container.get<RoomMediator>('RoomMediator');
        let orgs = await container.get<OrganizationModule>(OrganizationModule);
        let USER_ID = await randomUser(ctx);
        let USER2_ID = await randomUser(ctx);
        let org = await orgs.createOrganization(ctx, USER_ID, { name: 'Org', isCommunity: true });
        let room = await mediator.createRoom(ctx, 'public', org.id, USER_ID, [], { title: 'Room' });
        await mediator.joinRoom(ctx, room.id, USER2_ID);
        let members = await Store.RoomParticipant.active.findAll(ctx, room.id);
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
        members = await Store.RoomParticipant.active.findAll(ctx, room.id);
        expect(members.length).toBe(1);
        expect(members[0].uid).toBe(USER_ID);
    });
});
