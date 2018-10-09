import { Transaction } from 'sequelize';
import { Emails } from '../services/Emails';
import { Repos } from '.';
import { DB } from '../tables';

export const Hooks = {
    onOrganizstionCreated: async (uid: number, oid: number, tx: Transaction) => {
        // let chat = await Repos.Chats.loadOrganizationalChat(oid, oid, tx);
        // let profile = await DB.UserProfile.find({ where: { userId: uid }, transaction: tx });
        // await Repos.Chats.sendMessage(tx, chat.id, uid, { message: `${profile!.firstName} has joined organization`, isService: true, isMuted: true });
    },
    onUserJoined: async (uid: number, oid: number, tx: Transaction) => {
        await Emails.sendMemberJoinedEmails(oid, uid, tx);
        let chat = await Repos.Chats.loadOrganizationalChat(oid, oid, tx);
        let profile = await DB.UserProfile.find({ where: { userId: uid }, transaction: tx });
        await Repos.Chats.sendMessage(tx, chat.id, uid, { message: `${profile!.firstName} has joined organization`, isService: true, isMuted: true });
    },
    onUserRemoved: async (uid: number, oid: number, tx: Transaction) => {
        //
    }
};