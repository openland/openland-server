import { testEnvironmentEnd, testEnvironmentStart } from '../openland-modules/testEnvironment';
import {
    Emails,
    TEMPLATE_ACTIVATEED,
    TEMPLATE_DEACTIVATED,
    TEMPLATE_INVITE,
    TEMPLATE_MEMBER_JOINED,
    TEMPLATE_MEMBER_REMOVED,
    TEMPLATE_MEMBERSHIP_LEVEL_CHANGED,
    TEMPLATE_PRIVATE_ROOM_INVITE,
    TEMPLATE_ROOM_INVITE, TEMPLATE_ROOM_INVITE_ACCEPTED,
    TEMPLATE_SIGIN_CODE,
    TEMPLATE_SIGNUP_CODE,
    TEMPLATE_UNREAD_MESSAGE,
    TEMPLATE_UNREAD_MESSAGES,
    TEMPLATE_WELCOME
} from './Emails';
import { Context, createEmptyContext } from '../openland-utils/Context';
import { container } from '../openland-modules/Modules.container';
import { UsersModule } from '../openland-module-users/UsersModule';
import { UserRepository } from '../openland-module-users/repositories/UserRepository';
import { Modules } from '../openland-modules/Modules';
import { EmailTask } from './EmailTask';
import { loadMessagingTestModule } from '../openland-module-messaging/Messaging.container.test';
import { FDB } from '../openland-module-db/FDB';
import { Message } from '../openland-module-db/schema';
import { OrganizationRepository } from '../openland-module-organization/repositories/OrganizationRepository';
import { OrganizationModule } from '../openland-module-organization/OrganizationModule';
import { SuperModule } from '../openland-module-super/SuperModule';
import { loadInvitesModule } from '../openland-module-invites/Invites.container';

// Welcome and Organization activated email delivery rules:
//
//  Welcome:
//  - user signed up via invite (to org, chat or openland)
//
//  Organization activated:
//  - user was activated by super-admin
//  - user used invite after sign up (to org, chat or openland)
//  - user was added to already activated org
//

describe('Emails', () => {
    beforeAll(async () => {
        await testEnvironmentStart('Emails');
        loadMessagingTestModule();
        container.bind('OrganizationRepository').to(OrganizationRepository).inSingletonScope();
        container.bind(OrganizationModule).toSelf().inSingletonScope();
        container.bind(UsersModule).toSelf().inSingletonScope();
        container.bind('UserRepository').to(UserRepository).inSingletonScope();
        container.bind(SuperModule).toSelf().inSingletonScope();
        loadInvitesModule();
    });
    afterAll(() => {
        testEnvironmentEnd();
    });

    const getSpy = () => {
        let spy = jest.spyOn(Modules.Email, 'enqueueEmail');
        spy.mockReset();
        return spy;
    };

    const randStr = () => (Math.random() * Math.pow(2, 55)).toString(16);

    async function randomUser(ctx: Context) {
        let users = container.get<UsersModule>(UsersModule);
        let email = 'test' + randStr() + '@openland.com';
        let uid = (await users.createUser(ctx, 'user' + randStr(), email)).id;
        await users.createUserProfile(ctx, uid, { firstName: 'User Name' + Math.random() });
        return { uid, email };
    }

    it('should send welcome email', async () => {
        let ctx = createEmptyContext();
        let spy = getSpy();
        let {uid, email} = await randomUser(ctx);
        await Modules.Users.activateUser(ctx, uid, true);
        let args: EmailTask = spy.mock.calls[0][1];
        expect(spy.mock.calls.length).toBe(1);
        expect(args.templateId).toBe(TEMPLATE_WELCOME);
        expect(args.to).toBe(email);
    });

    it('should send welcome email if joined with invite', async () => {
        let ctx = createEmptyContext();
        let {uid, email} = await randomUser(ctx);
        let {uid: uid2} = await randomUser(ctx);

        let org = await Modules.Orgs.createOrganization(ctx, uid2, { name: 'test' });
        await Modules.Orgs.activateOrganization(ctx, org.id, false);
        let invite = await Modules.Invites.orgInvitesRepo.getAppInviteLinkKey(ctx, uid2);

        let spy = getSpy();

        await Modules.Invites.joinAppInvite(ctx, uid, invite, true);
        let args: EmailTask = spy.mock.calls[0][1];
        expect(spy.mock.calls.length).toBe(1);
        expect(args.templateId).toBe(TEMPLATE_WELCOME);
        expect(args.to).toBe(email);
    });

    it('should send unread message email', async () => {
        let ctx = createEmptyContext();
        let spy = getSpy();
        let {uid, email} = await randomUser(ctx);

        let chat = await Modules.Messaging.room.createRoom(ctx, 'group', 1, uid, [], { title: '' });
        let event = await Modules.Messaging.sendMessage(ctx, chat.id, uid, { message: 'test' });
        let message = (await FDB.Message.findById(ctx, event.mid!))!;

        await Emails.sendUnreadMessages(ctx, uid, [message]);

        let args: EmailTask = spy.mock.calls[0][1];
        expect(spy.mock.calls.length).toBe(1);
        expect(args.templateId).toBe(TEMPLATE_UNREAD_MESSAGE);
        expect(args.to).toBe(email);
    });

    it('should send unread messages email', async () => {
        let ctx = createEmptyContext();
        let spy = getSpy();
        let {uid, email} = await randomUser(ctx);

        let chat = await Modules.Messaging.room.createRoom(ctx, 'group', 1, uid, [], { title: '' });
        let messages: Message[] = [];
        let event = await Modules.Messaging.sendMessage(ctx, chat.id, uid, { message: 'test' });
        messages.push((await FDB.Message.findById(ctx, event.mid!))!);
        let event2 = await Modules.Messaging.sendMessage(ctx, chat.id, uid, { message: 'test' });
        messages.push((await FDB.Message.findById(ctx, event2.mid!))!);

        await Emails.sendUnreadMessages(ctx, uid, messages);

        let args: EmailTask = spy.mock.calls[0][1];
        expect(spy.mock.calls.length).toBe(1);
        expect(args.templateId).toBe(TEMPLATE_UNREAD_MESSAGES);
        expect(args.to).toBe(email);
    });

    it('should send account activated Email', async () => {
        let ctx = createEmptyContext();
        let spy = getSpy();
        let {uid, email} = await randomUser(ctx);
        let {uid: uid2, email: email2} = await randomUser(ctx);

        let org = await Modules.Orgs.createOrganization(ctx, uid, { name: 'test' });
        await Modules.Orgs.addUserToOrganization(ctx, uid2, org.id, uid);

        await Modules.Orgs.activateOrganization(ctx, org.id, true);

        expect(spy.mock.calls.length).toBe(2);

        //
        //  Organization Activated emails
        //
        let args: EmailTask = spy.mock.calls[0][1];
        expect(args.templateId).toBe(TEMPLATE_ACTIVATEED);
        expect(args.to).toBe(email);

        let args2: EmailTask = spy.mock.calls[1][1];
        expect(args2.templateId).toBe(TEMPLATE_ACTIVATEED);
        expect(args2.to).toBe(email2);
    });

    it('should send account deactivated Email', async () => {
        let ctx = createEmptyContext();
        let {uid, email} = await randomUser(ctx);
        let {uid: uid2, email: email2} = await randomUser(ctx);

        let org = await Modules.Orgs.createOrganization(ctx, uid, { name: 'test' });
        await Modules.Orgs.addUserToOrganization(ctx, uid2, org.id, uid);

        await Modules.Orgs.activateOrganization(ctx, org.id, false);

        let spy = getSpy();
        await Modules.Orgs.suspendOrganization(ctx, org.id);

        expect(spy.mock.calls.length).toBe(2);
        let args: EmailTask = spy.mock.calls[0][1];
        expect(args.templateId).toBe(TEMPLATE_DEACTIVATED);
        expect(args.to).toBe(email);

        let args2: EmailTask = spy.mock.calls[1][1];
        expect(args2.templateId).toBe(TEMPLATE_DEACTIVATED);
        expect(args2.to).toBe(email2);
    });

    it('should send member removed email', async () => {
        let ctx = createEmptyContext();
        let {uid} = await randomUser(ctx);
        let {uid: uid2, email: email2} = await randomUser(ctx);

        let org = await Modules.Orgs.createOrganization(ctx, uid, { name: 'test' });
        let org2 = await Modules.Orgs.createOrganization(ctx, uid, { name: 'test' });
        await Modules.Orgs.addUserToOrganization(ctx, uid2, org.id, uid);
        await Modules.Orgs.addUserToOrganization(ctx, uid2, org2.id, uid);
        await Modules.Orgs.activateOrganization(ctx, org.id, false);

        let spy = getSpy();
        await Modules.Orgs.removeUserFromOrganization(ctx, uid2, org.id, uid);

        expect(spy.mock.calls.length).toBe(1);
        let args: EmailTask = spy.mock.calls[0][1];
        expect(args.templateId).toBe(TEMPLATE_MEMBER_REMOVED);
        expect(args.to).toBe(email2);
    });

    it('should send membership level changed email', async () => {
        let ctx = createEmptyContext();
        let {uid} = await randomUser(ctx);
        let {uid: uid2, email: email2} = await randomUser(ctx);

        let org = await Modules.Orgs.createOrganization(ctx, uid, { name: 'test' });
        await Modules.Orgs.addUserToOrganization(ctx, uid2, org.id, uid);
        await Modules.Orgs.activateOrganization(ctx, org.id, false);

        let spy = getSpy();
        await Modules.Orgs.updateMemberRole(ctx, uid2, org.id, 'admin', uid);

        expect(spy.mock.calls.length).toBe(1);
        let args: EmailTask = spy.mock.calls[0][1];
        expect(args.templateId).toBe(TEMPLATE_MEMBERSHIP_LEVEL_CHANGED);
        expect(args.to).toBe(email2);
    });

    it('should send organization invite email', async () => {
        let ctx = createEmptyContext();
        let {uid} = await randomUser(ctx);
        let {email: email2} = await randomUser(ctx);

        let org = await Modules.Orgs.createOrganization(ctx, uid, { name: 'test' });
        await Modules.Orgs.activateOrganization(ctx, org.id, false);

        let spy = getSpy();
        await Modules.Invites.createOrganizationInvite(ctx, org.id, uid, { email: email2 });

        expect(spy.mock.calls.length).toBe(1);
        let args: EmailTask = spy.mock.calls[0][1];
        expect(args.templateId).toBe(TEMPLATE_INVITE);
        expect(args.to).toBe(email2);
    });

    it('should send member joined email', async () => {
        let ctx = createEmptyContext();
        let {uid, email} = await randomUser(ctx);
        let {uid: uid2, email: email2} = await randomUser(ctx);

        let org = await Modules.Orgs.createOrganization(ctx, uid, { name: 'test' });
        await Modules.Orgs.activateOrganization(ctx, org.id, false);

        let invite = await Modules.Invites.createOrganizationInvite(ctx, org.id, uid, { email: email2 });

        let spy = getSpy();
        await Modules.Invites.joinOrganizationInvite(ctx, uid2, invite!.id, true);

        expect(spy.mock.calls.length).toBe(2);
        //
        //  Welcome email
        //
        let args: EmailTask = spy.mock.calls[0][1];
        expect(args.templateId).toBe(TEMPLATE_WELCOME);
        expect(args.to).toBe(email2);

        //
        // Invitation accepted email
        //
        let args2: EmailTask = spy.mock.calls[1][1];
        expect(args2.templateId).toBe(TEMPLATE_MEMBER_JOINED);
        expect(args2.to).toBe(email);
    });

    it('should send activation code email', async () => {
        let ctx = createEmptyContext();
        let {email} = await randomUser(ctx);

        let spy = getSpy();
        await Emails.sendActivationCodeEmail(ctx, email, '11111', true);
        await Emails.sendActivationCodeEmail(ctx, email, '11111', false);

        expect(spy.mock.calls.length).toBe(2);
        let args: EmailTask = spy.mock.calls[0][1];
        expect(args.templateId).toBe(TEMPLATE_SIGIN_CODE);
        expect(args.to).toBe(email);

        let args2: EmailTask = spy.mock.calls[1][1];
        expect(args2.templateId).toBe(TEMPLATE_SIGNUP_CODE);
        expect(args2.to).toBe(email);
    });

    it('should send room invite email', async () => {
        let ctx = createEmptyContext();
        let spy = getSpy();
        let {uid} = await randomUser(ctx);
        let {email: email2} = await randomUser(ctx);

        let chat = await Modules.Messaging.room.createRoom(ctx, 'group', 1, uid, [], { title: '' });
        let chat2 = await Modules.Messaging.room.createRoom(ctx, 'public', 1, uid, [], { title: '' });

        await Modules.Invites.createRoomInvite(ctx, chat.id, uid, email2);
        await Modules.Invites.createRoomInvite(ctx, chat2.id, uid, email2);

        expect(spy.mock.calls.length).toBe(2);
        let args: EmailTask = spy.mock.calls[0][1];
        expect(args.templateId).toBe(TEMPLATE_PRIVATE_ROOM_INVITE);
        expect(args.to).toBe(email2);

        let args2: EmailTask = spy.mock.calls[1][1];
        expect(args2.templateId).toBe(TEMPLATE_ROOM_INVITE);
        expect(args2.to).toBe(email2);
    });

    it('should send room invite accepted email', async () => {
        let ctx = createEmptyContext();
        let {uid, email} = await randomUser(ctx);
        let {uid: uid2, email: email2} = await randomUser(ctx);

        let chat = await Modules.Messaging.room.createRoom(ctx, 'group', 1, uid, [], { title: '' });

        let invite = await Modules.Invites.createRoomInvite(ctx, chat.id, uid, email2);

        let spy = getSpy();
        await Modules.Invites.joinRoomInvite(ctx, uid2, invite.id, true);
        expect(spy.mock.calls.length).toBe(2);
        //
        //  Welcome email
        //
        let args2: EmailTask = spy.mock.calls[0][1];
        expect(args2.templateId).toBe(TEMPLATE_WELCOME);
        expect(args2.to).toBe(email2);

        //
        //  Invite accepted email
        //
        let args: EmailTask = spy.mock.calls[1][1];
        expect(args.templateId).toBe(TEMPLATE_ROOM_INVITE_ACCEPTED);
        expect(args.to).toBe(email);

    });
});