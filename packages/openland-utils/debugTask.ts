import { Modules } from '../openland-modules/Modules';
import { Context, createNamedContext } from '@openland/context';
import { inTx, Subspace, TupleItem } from '@openland/foundationdb';
import { createLogger } from '@openland/log';
import { EntityFactory } from '@openland/foundationdb-entity';

const rootCtx = createNamedContext('debug-task');
const logger = createLogger('debug-task');

export function debugTask(uid: number, name: string, handler: (log: (str: string) => Promise<void>) => Promise<string>) {
    // tslint:disable-next-line:no-floating-promises
    (async () => {
        let key = (Math.random() * Math.pow(2, 55)).toString(16);
        let superNotificationsAppId = await inTx(rootCtx, async ctx => await Modules.Super.getEnvVar<number>(ctx, 'super-notifications-app-id'));

        const sendLog = async (str: string) => {
            logger.log(rootCtx, str);
            if (superNotificationsAppId) {
                await inTx(rootCtx, async ctx => {
                    let conv = await Modules.Messaging.room.resolvePrivateChat(ctx, uid, superNotificationsAppId!);
                    await Modules.Messaging.sendMessage(ctx, conv.id, superNotificationsAppId!, { message: `Task #${key}: ${str}` }, true);
                });
            }
        };
        await sendLog(`${name} started`);
        try {
            let res = await handler(sendLog);
            await sendLog(`${name} ended with response: ${res}`);
        } catch (e) {
            logger.error(rootCtx, name, e);
        }
    })();
}

export function debugTaskForAll(entity: EntityFactory<any, any>, uid: number, name: string, handler: (ctx: Context, uid: number, log: (str: string) => Promise<void>) => Promise<void>) {
    debugTask(uid, name, async (log) => {
        let allRecords = await inTx(rootCtx, async ctx => await entity.findAll(ctx));
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

type SubspaceIteratorNext<T> = (parent: Context, batchSize: number) => Promise<{ key: TupleItem[], value: T }[]>;
export function debugSubspaceIterator<T>(subspace: Subspace<TupleItem[], T>, uid: number, name: string, handler: (next: SubspaceIteratorNext<T>, log: (str: string) => Promise<void>) => Promise<string>) {
    debugTask(uid, name, async (log) => {
        let cursor: TupleItem[] | undefined = undefined;

        let next = async (parent: Context, batchSize: number) => {
            let data = await inTx(rootCtx, async ctx => await subspace.range(ctx, [], { after: cursor, limit: batchSize }));
            if (data.length > 0) {
                cursor = data[data.length - 1].key;
            }
            return data;
        };

        return await handler(next, log);
    });
}

export function debugTaskForAllBatched<T>(subspace: Subspace<TupleItem[], T>, uid: number, name: string, batchSize: number, handler: (items: { key: TupleItem[], value: T }[], log: (str: string) => Promise<void>) => Promise<void>) {
    debugSubspaceIterator<T>(subspace, uid, name, async (next, log) => {
        let res: { key: TupleItem[], value: T }[] = [];
        let total = 0;
        do {
            res = await next(rootCtx, batchSize);
            total += res.length;

            try {
                await handler(res, log);

                await log('done: ' + total);
            } catch (e) {
                await log('error: ' + e);
            }
        } while (res.length > 0);

        return 'done, total: ' + total;
    });
}