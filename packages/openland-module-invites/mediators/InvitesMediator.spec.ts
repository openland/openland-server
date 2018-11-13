import 'reflect-metadata';
import { InvitesChannelsRepository } from 'openland-module-invites/repositories/InvitesChannelsRepository';
import { testEnvironmentStart, testEnvironmentEnd } from 'openland-modules/testEnvironment';
import { loadMessagingTestModule } from 'openland-module-messaging/Messaging.container.test';
import { container } from 'openland-modules/Modules.container';
import { RoomMediator } from 'openland-module-messaging/mediators/RoomMediator';
import { OrganizationModule } from 'openland-module-organization/OrganizationModule';
import { UsersModule } from 'openland-module-users/UsersModule';
import { InvitesMediator } from './InvitesMediator';
import { loadInvitesModule } from 'openland-module-invites/Invites.container';
import { AllEntities } from 'openland-module-db/schema';
import { OrganizationRepository } from 'openland-module-organization/repositories/OrganizationRepository';
import { SuperModule } from 'openland-module-super/SuperModule';
import { HooksModule } from 'openland-module-hooks/HooksModule';
import { InvitesOrganizationRepository } from 'openland-module-invites/repositories/InvitesOrganizationRepository';
import { Modules } from 'openland-modules/Modules';

describe('InvitesMediator', () => {

    let users: UsersModule;
    let orgs: OrganizationModule;
    let entities: AllEntities;
    beforeAll(async () => {
        await testEnvironmentStart('invites-mediator');
        loadMessagingTestModule();
        loadInvitesModule();
        container.bind(SuperModule).toSelf().inSingletonScope();
        container.bind(HooksModule).toSelf().inSingletonScope();
        container.bind(OrganizationRepository).toSelf().inSingletonScope();
        container.bind(OrganizationModule).toSelf().inSingletonScope();
        container.bind(UsersModule).toSelf().inSingletonScope();

        entities = container.get<AllEntities>('FDB');
        users = container.get<UsersModule>(UsersModule);
        orgs = container.get<OrganizationModule>(OrganizationModule);
    });

    afterAll(() => {
        testEnvironmentEnd();
    });

    it('should add to channel via invite', async () => {
        let USER_ID = (await users.createUser('user111', 'email111')).id;
        let USER2_ID = (await users.createUser('user112', 'email112')).id;
        await users.createUserProfile(USER_ID, { firstName: 'User Name' });
        await users.createUserProfile(USER2_ID, { firstName: 'User Name' });

        let USER2_ORG_ID = (await orgs.createOrganization(USER2_ID, { name: 'ACME' })).id;

        let roomMediator = container.get<RoomMediator>('RoomMediator');
        let channel = await roomMediator.createRoom('public', 1, USER_ID, [], { title: 'channel' });

        let repo = container.get<InvitesChannelsRepository>('InvitesChannelsRepository');
        let invite = await repo.createChannelInviteLink(channel.id, USER_ID);

        let mediator = container.get<InvitesMediator>('InvitesMediator');

        await mediator.joinChannelInvite(USER2_ID, invite);
        let members = await roomMediator.findConversationMembers(channel.id);
        expect(members).toContain(USER2_ID);

        // should activate user
        let user = (await entities.User.findById(USER2_ID))!;
        expect(user.status).toEqual('activated');

        // should activate user orgs
        let org = (await entities.Organization.findById(USER2_ORG_ID))!;
        expect(org.status).toEqual('activated');
    });

    it('should activate via invite', async () => {
        let USER_ID = (await users.createUser('user_app_1', 'email_app_1')).id;
        await users.createUserProfile(USER_ID, { firstName: 'User Name' });

        let USER_ORG_ID = (await orgs.createOrganization(USER_ID, { name: 'ACME' })).id;

        let repo = container.get<InvitesOrganizationRepository>('InvitesOrganizationRepository');
        let invite = await repo.getAppInviteLinkKey(1);

        let mediator = container.get<InvitesMediator>('InvitesMediator');

        await mediator.joinAppInvite(USER_ID, invite);

        // should activate user
        let user = (await entities.User.findById(USER_ID))!;
        expect(user.status).toEqual('activated');

        // should activate user orgs
        let org = (await entities.Organization.findById(USER_ORG_ID))!;
        expect(org.status).toEqual('activated');
    });

    it('should add to organization via email invite', async () => {
        let USER_ID = (await users.createUser('user_org_1', 'email_org_1')).id;
        let USER2_ID = (await users.createUser('user_org_2', 'email_org_2')).id;
        await users.createUserProfile(USER_ID, { firstName: 'User Name' });
        await users.createUserProfile(USER2_ID, { firstName: 'User Name' });

        let USER_ORG_ID = (await orgs.createOrganization(USER_ID, { name: 'ACME' })).id;
        await orgs.activateOrganization(USER_ORG_ID);

        let repo = container.get<InvitesOrganizationRepository>('InvitesOrganizationRepository');
        let invite = await repo.createOrganizationInvite(USER_ORG_ID, USER_ID, '', '', '', '', 'MEMBER');

        let mediator = container.get<InvitesMediator>('InvitesMediator');

        await mediator.joinOrganizationInvite(USER2_ID, invite.id);

        // should add user to org
        let members = (await Modules.Orgs.findOrganizationMembers(USER_ORG_ID)).map(u => u.id);
        expect(members).toContain(USER2_ID);

        // should activate user
        let user = (await entities.User.findById(USER2_ID))!;
        expect(user.status).toEqual('activated');

        // should make org primary
        let userProfile = (await entities.UserProfile.findById(USER2_ID))!;
        expect(userProfile.primaryOrganization).toEqual(USER_ORG_ID);
    });

    it('should add to organization via public invite', async () => {
        let USER_ID = (await users.createUser('user_org_p_1', 'email_org_p_1')).id;
        let USER2_ID = (await users.createUser('user_org_p_2', 'email_org_p_2')).id;
        await users.createUserProfile(USER_ID, { firstName: 'User Name' });
        await users.createUserProfile(USER2_ID, { firstName: 'User Name' });

        let USER_ORG_ID = (await orgs.createOrganization(USER_ID, { name: 'ACME' })).id;
        await orgs.activateOrganization(USER_ORG_ID);

        let repo = container.get<InvitesOrganizationRepository>('InvitesOrganizationRepository');
        let invite = await repo.refreshOrganizationInviteLink(USER_ORG_ID, USER_ID);

        let mediator = container.get<InvitesMediator>('InvitesMediator');

        await mediator.joinOrganizationInvite(USER2_ID, invite.id);

        // should add user to org
        let members = (await Modules.Orgs.findOrganizationMembers(USER_ORG_ID)).map(u => u.id);
        expect(members).toContain(USER2_ID);

        // should activate user
        let user = (await entities.User.findById(USER2_ID))!;
        expect(user.status).toEqual('activated');

        // should make org primary
        let userProfile = (await entities.UserProfile.findById(USER2_ID))!;
        expect(userProfile.primaryOrganization).toEqual(USER_ORG_ID);
    });

});