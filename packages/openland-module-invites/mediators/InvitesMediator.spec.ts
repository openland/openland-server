import 'reflect-metadata';
import { InvitesRoomRepository } from 'openland-module-invites/repositories/InvitesRoomRepository';
import { testEnvironmentStart, testEnvironmentEnd, randomTestUser } from 'openland-modules/testEnvironment';
import { loadMessagingTestModule } from 'openland-module-messaging/Messaging.container.test';
import { container } from 'openland-modules/Modules.container';
import { RoomMediator } from 'openland-module-messaging/mediators/RoomMediator';
import { OrganizationModule } from 'openland-module-organization/OrganizationModule';
import { UsersModule } from 'openland-module-users/UsersModule';
import { InvitesMediator } from './InvitesMediator';
import { loadInvitesModule } from 'openland-module-invites/Invites.container';
import { OrganizationRepository } from 'openland-module-organization/repositories/OrganizationRepository';
import { SuperModule } from 'openland-module-super/SuperModule';
import { HooksModule } from 'openland-module-hooks/HooksModule';
import { InvitesOrganizationRepository } from 'openland-module-invites/repositories/InvitesOrganizationRepository';
import { Modules } from 'openland-modules/Modules';
import { createNamedContext } from '@openland/context';
import { loadUsersModule } from '../../openland-module-users/UsersModule.container';
import { Store } from 'openland-module-db/FDB';

describe('InvitesMediator', () => {

    let users: UsersModule;
    let orgs: OrganizationModule;
    beforeAll(async () => {
        await testEnvironmentStart('invites-mediator');
        loadMessagingTestModule();
        loadInvitesModule();
        container.bind(SuperModule).toSelf().inSingletonScope();
        container.bind(HooksModule).toSelf().inSingletonScope();
        container.bind('OrganizationRepository').to(OrganizationRepository).inSingletonScope();
        container.bind(OrganizationModule).toSelf().inSingletonScope();
        container.bind(UsersModule).toSelf().inSingletonScope();
        loadUsersModule();

        users = container.get<UsersModule>(UsersModule);
        orgs = container.get<OrganizationModule>(OrganizationModule);
    });

    afterAll( async () => {
      await  testEnvironmentEnd();
    });

    it('should add to channel via invite', async () => {
        let ctx = createNamedContext('test');
        let USER_ID = (await randomTestUser(ctx)).uid;
        let USER2_ID = (await users.createUser(ctx, {email: 'email112'})).id;
        await users.createUserProfile(ctx, USER2_ID, { firstName: 'User Name' });
        let oid = (await Modules.Orgs.createOrganization(ctx, USER_ID, { name: '1' })).id;

        let USER2_ORG_ID = (await orgs.createOrganization(ctx, USER2_ID, { name: 'ACME' })).id;

        let roomMediator = container.get<RoomMediator>('RoomMediator');
        let channel = await roomMediator.createRoom(ctx, 'public', oid, USER_ID, [], { title: 'channel' });

        let repo = container.get<InvitesRoomRepository>('InvitesRoomRepository');
        let invite = await repo.createRoomInviteLink(ctx, channel.id, USER_ID);

        let mediator = container.get<InvitesMediator>('InvitesMediator');

        await mediator.joinRoomInvite(ctx, USER2_ID, invite, true);
        let members = await roomMediator.findConversationMembers(ctx, channel.id);
        expect(members).toContain(USER2_ID);

        // should activate user
        let user = (await Store.User.findById(ctx, USER2_ID))!;
        expect(user.status).toEqual('activated');

        // should activate user orgs
        let org = (await Store.Organization.findById(ctx, USER2_ORG_ID))!;
        expect(org.status).toEqual('activated');
    });

    it('should activate via invite', async () => {
        let ctx = createNamedContext('test');
        let USER_ID = (await users.createUser(ctx, {email: 'email_app_1'})).id;
        await users.createUserProfile(ctx, USER_ID, { firstName: 'User Name' });

        let USER_ORG_ID = (await orgs.createOrganization(ctx, USER_ID, { name: 'ACME' })).id;

        let repo = container.get<InvitesOrganizationRepository>('InvitesOrganizationRepository');
        let invite = await repo.getAppInviteLinkKey(ctx, 1);

        let mediator = container.get<InvitesMediator>('InvitesMediator');

        await mediator.joinAppInvite(ctx, USER_ID, invite, true);

        // should activate user
        let user = (await Store.User.findById(ctx, USER_ID))!;
        expect(user.status).toEqual('activated');

        // should activate user orgs
        let org = (await Store.Organization.findById(ctx, USER_ORG_ID))!;
        expect(org.status).toEqual('activated');
    });

    it('should add to organization via email invite', async () => {
        let ctx = createNamedContext('test');
        let USER_ID = (await users.createUser(ctx, {email: 'email_org_1'})).id;
        let USER2_ID = (await users.createUser(ctx, {email: 'email_org_2'})).id;
        await users.createUserProfile(ctx, USER_ID, { firstName: 'User Name' });
        await users.createUserProfile(ctx, USER2_ID, { firstName: 'User Name' });

        let USER_ORG_ID = (await orgs.createOrganization(ctx, USER_ID, { name: 'ACME' })).id;
        await orgs.activateOrganization(ctx, USER_ORG_ID, true);

        let repo = container.get<InvitesOrganizationRepository>('InvitesOrganizationRepository');
        let invite = await repo.createOrganizationInvite(ctx, USER_ORG_ID, USER_ID, '', '', '', '');

        let mediator = container.get<InvitesMediator>('InvitesMediator');

        await mediator.joinOrganizationInvite(ctx, USER2_ID, invite.id, true);

        // should add user to org
        let members = (await Modules.Orgs.findOrganizationMembers(ctx, USER_ORG_ID)).map(u => u.id);
        expect(members).toContain(USER2_ID);

        // should activate user
        let user = (await Store.User.findById(ctx, USER2_ID))!;
        expect(user.status).toEqual('activated');

        // should make org primary
        let userProfile = (await Store.UserProfile.findById(ctx, USER2_ID))!;
        expect(userProfile.primaryOrganization).toEqual(USER_ORG_ID);
    });

    it('should add to organization via public invite', async () => {
        let ctx = createNamedContext('test');
        let USER_ID = (await users.createUser(ctx, {email: 'email_org_p_1'})).id;
        let USER2_ID = (await users.createUser(ctx, {email: 'email_org_p_2'})).id;
        await users.createUserProfile(ctx, USER_ID, { firstName: 'User Name' });
        await users.createUserProfile(ctx, USER2_ID, { firstName: 'User Name' });

        let USER_ORG_ID = (await orgs.createOrganization(ctx, USER_ID, { name: 'ACME' })).id;
        await orgs.activateOrganization(ctx, USER_ORG_ID, true);

        let repo = container.get<InvitesOrganizationRepository>('InvitesOrganizationRepository');
        let invite = await repo.refreshOrganizationInviteLink(ctx, USER_ORG_ID, USER_ID);

        let mediator = container.get<InvitesMediator>('InvitesMediator');

        await mediator.joinOrganizationInvite(ctx, USER2_ID, invite.id, true);

        // should add user to org
        let members = (await Modules.Orgs.findOrganizationMembers(ctx, USER_ORG_ID)).map(u => u.id);
        expect(members).toContain(USER2_ID);

        // should activate user
        let user = (await Store.User.findById(ctx, USER2_ID))!;
        expect(user.status).toEqual('activated');

        // should make org primary
        let userProfile = (await Store.UserProfile.findById(ctx, USER2_ID))!;
        expect(userProfile.primaryOrganization).toEqual(USER_ORG_ID);
    });

});
