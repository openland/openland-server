import { Modules } from 'openland-modules/Modules';
import { injectable } from 'inversify';
import { createHyperlogger } from 'openland-module-hyperlog/createHyperlogEvent';

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

    onUserProfileUpdated = async (uid: number) => {
        await profileUpdated.event({ uid });
        await Modules.Messaging.onUserProfileUpdated(uid);
    }

    onOrganizationProfileUpdated = async (oid: number) => {
        await organizationProfileUpdated.event({ oid });
        await Modules.Messaging.onOrganizationProfileUpdated(oid);
    }

    onOrganizationCreated = async (uid: number, oid: number) => {
        await organizationCreated.event({ uid, oid });
        // let chat = await Repos.Chats.loadOrganizationalChat(oid, oid, tx);
        // let profile = await DB.UserProfile.find({ where: { userId: uid }, transaction: tx });
        // await Repos.Chats.sendMessage(tx, chat.id, uid, { message: `${profile!.firstName} has joined organization`, isService: true, isMuted: true });
    }

    /*
     * Membership
     */

    onUserJoined = async (uid: number, oid: number) => {
        // await Emails.sendMemberJoinedEmails(oid, uid, tx);
        let chat = await Modules.Messaging.room.resolveOrganizationChat(oid);
        let profile = await Modules.Users.profileById(uid);
        await Modules.Messaging.sendMessage(chat.id, uid, { message: `${profile!.firstName} has joined organization`, isService: true, isMuted: true });
    }

    onUserRemoved = async (uid: number, oid: number) => {
        //
    }
}