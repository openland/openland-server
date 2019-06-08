import { Modules } from '../openland-modules/Modules';
import { createNamedContext } from '@openland/context';

const rootCtx = createNamedContext('debug-task');

export function debugTask(uid: number, name: string, handler: (log: (str: string) => Promise<void>) => Promise<string>) {
    // tslint:disable-next-line:no-floating-promises
    (async () => {
        let key = (Math.random() * Math.pow(2, 55)).toString(16);
        let superNotificationsAppId = await Modules.Super.getEnvVar<number>(rootCtx, 'super-notifications-app-id');

        const sendLog = async (str: string) => {
            if (superNotificationsAppId) {
                let ctx = rootCtx;
                let conv = await Modules.Messaging.room.resolvePrivateChat(ctx, uid, superNotificationsAppId);
                await Modules.Messaging.sendMessage(ctx, conv.id, superNotificationsAppId, { message: `Task #${key}: ${str}` }, true);
            }
        };
        await sendLog(`Task #${key} ${name} started`);
        let res = await handler(sendLog);
        await sendLog(`Task #${key} ${name} ended with response: ${res}`);
    })();
}