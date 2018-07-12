import { Transaction } from 'sequelize';
import { Emails } from '../services/Emails';
import { Repos } from '.';

export const Hooks = {
    onOrganizstionCreated: async (uid: number, oid: number, tx: Transaction) => {
        let chat = await Repos.Chats.loadOrganizationalChat(oid, oid, tx);
        await Repos.Chats.sendMessage(tx, chat.id, uid, { message: 'Joined organization', isService: true, isMuted: true });
    },
    onUserJoined: async (uid: number, oid: number, tx: Transaction) => {
        await Emails.sendMemberJoinedEmails(oid, uid, tx);
        let chat = await Repos.Chats.loadOrganizationalChat(oid, oid, tx);
        await Repos.Chats.sendMessage(tx, chat.id, uid, { message: 'Joined organization', isService: true, isMuted: true });
    },
    onUserRemoved: async (uid: number, oid: number, tx: Transaction) => {
        //
    }
};