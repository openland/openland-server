import { Modules } from 'openland-modules/Modules';
import { injectable } from 'inversify';

@injectable()
export class HooksModule {

    start = () => {
        // Nothing to do
    }

    onUserProfileUpdated = async (uid: number) => {
        //
    }

    onOrganizationProfileUpdated = async (oid: number) => {
        //
    }

    onOrganizationCreated = async (uid: number, oid: number) => {
        // let chat = await Repos.Chats.loadOrganizationalChat(oid, oid, tx);
        // let profile = await DB.UserProfile.find({ where: { userId: uid }, transaction: tx });
        // await Repos.Chats.sendMessage(tx, chat.id, uid, { message: `${profile!.firstName} has joined organization`, isService: true, isMuted: true });
    }

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