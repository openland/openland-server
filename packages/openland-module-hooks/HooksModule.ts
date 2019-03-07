import { Modules } from 'openland-modules/Modules';
import { injectable } from 'inversify';
import { createHyperlogger } from 'openland-module-hyperlog/createHyperlogEvent';
import { Context } from 'openland-utils/Context';
import { IDs } from '../openland-module-api/IDs';

const profileUpdated = createHyperlogger<{ uid: number }>('profile-updated');
const organizationProfileUpdated = createHyperlogger<{ oid: number }>('organization-profile-updated');
const organizationCreated = createHyperlogger<{ oid: number, uid: number }>('organization-created');

const SuperNotificationsAppId = 2498;
const SuperNotificationsChatId = 35525;

@injectable()
export class HooksModule {

    start = () => {
        // Nothing to do
    }

    /*
     * Profiles
     */

    onUserProfileUpdated = async (ctx: Context, uid: number) => {
        await profileUpdated.event(ctx, { uid });
        await Modules.Messaging.onUserProfileUpdated(ctx, uid);
    }

    onOrganizationProfileUpdated = async (ctx: Context, oid: number) => {
        await organizationProfileUpdated.event(ctx, { oid });
        await Modules.Messaging.onOrganizationProfileUpdated(ctx, oid);
    }

    onOrganizationCreated = async (ctx: Context, uid: number, oid: number) => {
        await organizationCreated.event(ctx, { uid, oid });
        // let chat = await Repos.Chats.loadOrganizationalChat(oid, oid, tx);
        // let profile = await DB.UserProfile.find({ where: { userId: uid }, transaction: tx });
        // await Repos.Chats.sendMessage(tx, chat.id, uid, { message: `${profile!.firstName} has joined organization`, isService: true, isMuted: true });
    }

    /*
     * Membership
     */

    onUserJoined = async (ctx: Context, uid: number, oid: number) => {
        // await Emails.sendMemberJoinedEmails(ctx, oid, uid);
        let chat = await Modules.Messaging.room.resolveOrganizationChat(ctx, oid);
        let profile = await Modules.Users.profileById(ctx, uid);
        await Modules.Messaging.sendMessage(ctx, chat.id, uid, { message: `${profile!.firstName} has joined organization`, isService: true, isMuted: true });
    }

    onUserRemoved = async (ctx: Context, uid: number, oid: number) => {
        //
    }

    /*
     * Orgs
     */
    onOrganizationActivated = async (ctx: Context, oid: number, conditions: { type: 'BY_SUPER_ADMIN', uid: number } | { type: 'BY_INVITE', inviteType: 'APP' | 'ROOM' } | { type: 'OWNER_ADDED_TO_ORG', owner: number, otherOid: number }) => {
        if (process.env.APP_ENVIRONMENT !== 'production') {
            return;
        }

        let message = '';
        let orgUrl = 'openland.com/directory/o/' + IDs.Organization.serialize(oid);

        if (conditions.type === 'BY_SUPER_ADMIN') {
            let adminUrl = 'openland.com/directory/u/' + IDs.User.serialize(conditions.uid);
            message = `Organization ${orgUrl} was activated by super-admin ${adminUrl}`;
        } else if (conditions.type === 'BY_INVITE') {
            message = `Organization ${orgUrl} was activated by ${conditions.inviteType} invite`;
        }  else if (conditions.type === 'OWNER_ADDED_TO_ORG') {
            let ownerUrl = 'openland.com/directory/u/' + IDs.User.serialize(conditions.owner);
            let otherOrgUrl = 'openland.com/directory/o/' + IDs.Organization.serialize(conditions.otherOid);
            message = `Organization ${orgUrl} was activated because owner (${ownerUrl}) was invited to org ${otherOrgUrl}`;
        }

        await Modules.Messaging.sendMessage(ctx, SuperNotificationsChatId, SuperNotificationsAppId, { message, ignoreAugmentation: true });
    }

    onOrganizationSuspended = async (ctx: Context, oid: number, conditions: { type: 'BY_SUPER_ADMIN', uid: number }) => {
        if (process.env.APP_ENVIRONMENT !== 'production') {
            return;
        }

        let message = '';
        let orgUrl = 'openland.com/directory/o/' + IDs.Organization.serialize(oid);

        if (conditions.type === 'BY_SUPER_ADMIN') {
            let adminUrl = 'openland.com/directory/u/' + IDs.User.serialize(conditions.uid);
            message = `Organization ${orgUrl} was suspended by super-admin ${adminUrl}`;
        }

        await Modules.Messaging.sendMessage(ctx, SuperNotificationsChatId, SuperNotificationsAppId, { message, ignoreAugmentation: true });
    }

    onSignUp = async (ctx: Context, uid: number) => {
        if (process.env.APP_ENVIRONMENT !== 'production') {
            return;
        }

        let userUrl = 'openland.com/directory/o/' + IDs.User.serialize(uid);
        let message = `New signup: ${userUrl}`;

        await Modules.Messaging.sendMessage(ctx, SuperNotificationsChatId, SuperNotificationsAppId, { message, ignoreAugmentation: true });
    }
}