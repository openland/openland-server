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
import { inReadOnlyTx } from '@openland/foundationdb';

let rootCtx = createNamedContext('test');

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

    afterAll(async () => {
        await testEnvironmentEnd();
    });

    it('should add to channel via invite', async () => {
        let USER_ID = (await randomTestUser(rootCtx)).uid;
        let USER2_ID = (await users.createUser(rootCtx, { email: 'email112' })).id;
        await users.createUserProfile(rootCtx, USER2_ID, { firstName: 'User Name' });
        await Modules.Events.mediator.prepareUser(rootCtx, USER_ID);
        await Modules.Events.mediator.prepareUser(rootCtx, USER2_ID);
        let oid = (await Modules.Orgs.createOrganization(rootCtx, USER_ID, { name: '1' })).id;

        let USER2_ORG_ID = (await orgs.createOrganization(rootCtx, USER2_ID, { name: 'ACME' })).id;

        let roomMediator = container.get<RoomMediator>('RoomMediator');
        let channel = await roomMediator.createRoom(rootCtx, 'public', oid, USER_ID, [], { title: 'channel' });

        let repo = container.get<InvitesRoomRepository>('InvitesRoomRepository');
        let invite = await repo.createRoomInviteLink(rootCtx, channel.id, USER_ID);

        let mediator = container.get<InvitesMediator>('InvitesMediator');

        await mediator.joinRoomInvite(rootCtx, USER2_ID, invite, true);
        let members = await inReadOnlyTx(rootCtx, async (ctx) => await roomMediator.findConversationMembers(ctx, channel.id));
        expect(members).toContain(USER2_ID);

        // should activate user
        let user = await inReadOnlyTx(rootCtx, async (ctx) => (await Store.User.findById(ctx, USER2_ID))!);
        expect(user.status).toEqual('activated');

        // should activate user orgs
        let org = await inReadOnlyTx(rootCtx, async (ctx) => (await Store.Organization.findById(ctx, USER2_ORG_ID))!);
        expect(org.status).toEqual('activated');
    });

    it('should activate via invite', async () => {
        let USER_ID = (await users.createUser(rootCtx, { email: 'email_app_1' })).id;
        await users.createUserProfile(rootCtx, USER_ID, { firstName: 'User Name' });
        await Modules.Events.mediator.prepareUser(rootCtx, USER_ID);

        let USER_ORG_ID = (await orgs.createOrganization(rootCtx, USER_ID, { name: 'ACME' })).id;

        let repo = container.get<InvitesOrganizationRepository>('InvitesOrganizationRepository');
        let invite = await repo.getAppInviteLinkKey(rootCtx, 1);

        let mediator = container.get<InvitesMediator>('InvitesMediator');

        await mediator.joinAppInvite(rootCtx, USER_ID, invite, true);

        // should activate user
        let user = await inReadOnlyTx(rootCtx, async (ctx) => (await Store.User.findById(ctx, USER_ID))!);
        expect(user.status).toEqual('activated');

        // should activate user orgs
        let org = await inReadOnlyTx(rootCtx, async (ctx) => (await Store.Organization.findById(ctx, USER_ORG_ID))!);
        expect(org.status).toEqual('activated');
    });

    it('should add to organization via email invite', async () => {
        let USER_ID = (await users.createUser(rootCtx, { email: 'email_org_1' })).id;
        let USER2_ID = (await users.createUser(rootCtx, { email: 'email_org_2' })).id;
        await users.createUserProfile(rootCtx, USER_ID, { firstName: 'User Name' });
        await users.createUserProfile(rootCtx, USER2_ID, { firstName: 'User Name' });
        await Modules.Events.mediator.prepareUser(rootCtx, USER_ID);
        await Modules.Events.mediator.prepareUser(rootCtx, USER2_ID);

        let USER_ORG_ID = (await orgs.createOrganization(rootCtx, USER_ID, { name: 'ACME' })).id;
        await orgs.activateOrganization(rootCtx, USER_ORG_ID, true);

        let repo = container.get<InvitesOrganizationRepository>('InvitesOrganizationRepository');
        let invite = await repo.createOrganizationInvite(rootCtx, USER_ORG_ID, USER_ID, '', '', '', '');

        let mediator = container.get<InvitesMediator>('InvitesMediator');

        await mediator.joinOrganizationInvite(rootCtx, USER2_ID, invite.id, true);

        // should add user to org
        let members = await inReadOnlyTx(rootCtx, async (ctx) => (await Modules.Orgs.findOrganizationMembers(ctx, USER_ORG_ID)).map(u => u.id));
        expect(members).toContain(USER2_ID);

        // should activate user
        let user = await inReadOnlyTx(rootCtx, async (ctx) => (await Store.User.findById(ctx, USER2_ID))!);
        expect(user.status).toEqual('activated');
    });

    it('should add to organization via public invite', async () => {
        let USER_ID = (await users.createUser(rootCtx, { email: 'email_org_p_1' })).id;
        let USER2_ID = (await users.createUser(rootCtx, { email: 'email_org_p_2' })).id;
        await users.createUserProfile(rootCtx, USER_ID, { firstName: 'User Name' });
        await users.createUserProfile(rootCtx, USER2_ID, { firstName: 'User Name' });
        await Modules.Events.mediator.prepareUser(rootCtx, USER_ID);
        await Modules.Events.mediator.prepareUser(rootCtx, USER2_ID);

        let USER_ORG_ID = (await orgs.createOrganization(rootCtx, USER_ID, { name: 'ACME' })).id;
        await orgs.activateOrganization(rootCtx, USER_ORG_ID, true);

        let repo = container.get<InvitesOrganizationRepository>('InvitesOrganizationRepository');
        let invite = await repo.refreshOrganizationInviteLink(rootCtx, USER_ORG_ID, USER_ID);

        let mediator = container.get<InvitesMediator>('InvitesMediator');

        await mediator.joinOrganizationInvite(rootCtx, USER2_ID, invite.id, true);

        // should add user to org
        let members = await inReadOnlyTx(rootCtx, async (ctx) => (await Modules.Orgs.findOrganizationMembers(ctx, USER_ORG_ID)).map(u => u.id));
        expect(members).toContain(USER2_ID);

        // should activate user
        let user = await inReadOnlyTx(rootCtx, async (ctx) => (await Store.User.findById(ctx, USER2_ID))!);
        expect(user.status).toEqual('activated');
    });

});
