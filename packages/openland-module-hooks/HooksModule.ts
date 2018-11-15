import { Modules } from 'openland-modules/Modules';
import { injectable } from 'inversify';
import { createHyperlogger } from 'openland-module-hyperlog/createHyperlogEvent';
import { Context } from 'openland-utils/Context';

const profileUpdated = createHyperlogger<{ uid: number }>('profile-updated');
const organizationProfileUpdated = createHyperlogger<{ oid: number }>('organization-profile-updated');
const organizationCreated = createHyperlogger<{ oid: number, uid: number }>('organization-created');

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
        // await Emails.sendMemberJoinedEmails(oid, uid, tx);
        let chat = await Modules.Messaging.room.resolveOrganizationChat(ctx, oid);
        let profile = await Modules.Users.profileById(ctx, uid);
        await Modules.Messaging.sendMessage(ctx, chat.id, uid, { message: `${profile!.firstName} has joined organization`, isService: true, isMuted: true });
    }

    onUserRemoved = async (ctx: Context, uid: number, oid: number) => {
        //
    }
}