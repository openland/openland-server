import { Modules } from '../openland-modules/Modules';
import { Context, createNamedContext } from '@openland/context';
import { inTx } from '@openland/foundationdb';
import { createLogger } from '@openland/log';
import { EntityFactory } from '@openland/foundationdb-entity';

const rootCtx = createNamedContext('debug-task');
const logger = createLogger('debug-task');

export function debugTask(uid: number, name: string, handler: (log: (str: string) => Promise<void>) => Promise<string>) {
    // tslint:disable-next-line:no-floating-promises
    (async () => {
        let key = (Math.random() * Math.pow(2, 55)).toString(16);
        let superNotificationsAppId = await Modules.Super.getEnvVar<number>(rootCtx, 'super-notifications-app-id');

        const sendLog = async (str: string) => {
            logger.log(rootCtx, str);
            if (superNotificationsAppId) {
                let ctx = rootCtx;
                let conv = await Modules.Messaging.room.resolvePrivateChat(ctx, uid, superNotificationsAppId);
                await Modules.Messaging.sendMessage(ctx, conv.id, superNotificationsAppId, { message: `Task #${key}: ${str}` }, true);
            }
        };
        await sendLog(`started`);
        try {
            let res = await handler(sendLog);
            await sendLog(`ended with response: ${res}`);
        } catch (e) {
            logger.error(rootCtx, name, e);
        }
    })();
}

export function debugTaskForAll(entity: EntityFactory<any, any>, uid: number, name: string, handler: (ctx: Context, uid: number, log: (str: string) => Promise<void>) => Promise<void>) {
    debugTask(uid, name, async (log) => {
        let allRecords = await entity.findAll(rootCtx);
        let i = 0;

        for (let record of allRecords) {
            await inTx(rootCtx, async (ctx) => {
                await handler(ctx, record.id, log);
                if ((i % 100) === 0) {
                    await log('done: ' + i);
                }
                i++;
            });
        }
        return 'done, total: ' + i;
    });
}