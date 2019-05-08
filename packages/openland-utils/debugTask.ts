import { Modules } from '../openland-modules/Modules';
import { createEmptyContext } from './Context';

export function debugTask(uid: number, name: string, handler: (log: (str: string) => Promise<void>) => Promise<string>) {
    (async () => {
        let key = (Math.random() * Math.pow(2, 55)).toString(16);
        let superNotificationsAppId = await Modules.Super.getEnvVar<number>(createEmptyContext(), 'super-notifications-app-id');

        const sendLog = async (str: string) => {
            if (superNotificationsAppId) {
                let ctx = createEmptyContext();
                let conv = await Modules.Messaging.room.resolvePrivateChat(ctx, uid, superNotificationsAppId);
                await Modules.Messaging.sendMessage(ctx, conv.id, superNotificationsAppId, { message: str }, true);
            }
        };
        await sendLog(`Task #${key} ${name} started`);
        let res = await handler(sendLog);
        await sendLog(`Task #${key} ${name} ended with response: ${res}`);
    })();
}