import { JsonMap } from '../utils/json';
// import { Repos } from '../repositories/index';
// import { Modules } from 'openland-modules/Modules';
// import { inTx } from 'foundation-orm/inTx';

export type NotificationMessage = { message?: string | null, file?: string | null, fileMetadata?: JsonMap | null };

export const NotificationsBot = {
    async sendNotification(uid: number, message: NotificationMessage) {
        // TODO: Implement
        // return await inTx(async () => {
        //     let notificationsBot = await DB.User.findOne({
        //         where: {
        //             authId: 'bot_notifications'
        //         },
        //         transaction: tx
        //     });

        //     if (!notificationsBot) {
        //         throw new Error('Cant find notifications bot in DB');
        //     }

        //     let conv = await Modules.Messaging.conv.resolvePrivateChat(uid, notificationsBot.id!);
          
        //     await Repos.Chats.sendMessage(conv.id, notificationsBot.id!, message);
        // });
    }
};