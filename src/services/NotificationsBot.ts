import { JsonMap } from '../utils/json';
import { DB } from '../tables/index';
import { Repos } from '../repositories/index';

export const NotificationsBot = {
    async sendNotification(uid: number, message: { message?: string | null, file?: string | null, repeatKey?: string | null, fileMetadata?: JsonMap | null }) {
        return await DB.tx(async (tx) => {
            let notificationsBot = await DB.User.findOne({
                where: {
                    authId: 'bot_notifications'
                },
                transaction: tx
            });

            if (!notificationsBot) {
                throw new Error('Cant find notifications bot in DB');
            }

            let _uid1 = Math.min(uid, notificationsBot.id!);
            let _uid2 = Math.max(uid, notificationsBot.id!);

            let conversation = await DB.Conversation.find({
                where: {
                    member1Id: _uid1,
                    member2Id: _uid2,
                    type: 'private'
                },
                transaction: tx,
                lock: tx.LOCK.UPDATE
            });

            if (!conversation) {
                conversation = await DB.Conversation.create({
                    title: 'Notifications',
                    type: 'private',
                    member1Id: _uid1,
                    member2Id: _uid2,
                }, { transaction: tx });
            }

            await Repos.Chats.sendMessage(tx, conversation.id, notificationsBot.id!, message);
        });
    }
};