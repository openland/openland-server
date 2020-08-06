import { Context } from '@openland/context';
import { Config } from 'openland-config/Config';
import WebPush from 'web-push';
import { PushRepository } from 'openland-module-push/repositories/PushRepository';
import { WorkQueue } from 'openland-module-workers/WorkQueue';
import { WebPushTask } from './types';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { handleFail } from './util/handleFail';
import { inTx } from '@openland/foundationdb';
import { createLogger } from '@openland/log';
import { BetterWorkerQueue } from 'openland-module-workers/BetterWorkerQueue';
import { Store } from 'openland-module-db/FDB';

const log = createLogger('web-push');

export function createWebWorker(repo: PushRepository) {

    let deliverWebPush = async (root: Context, task: WebPushTask) => {
        let token = (await repo.getWebToken(root, task.tokenId))!;
        if (!token.enabled) {
            return;
        }

        try {
            let res = await WebPush.sendNotification(JSON.parse(token.endpoint), JSON.stringify({
                title: task.title,
                body: task.body,
                picture: task.picture,
                ...task.extras
            }));
            log.log(root, 'web_push', token.uid, JSON.stringify({ statusCode: res.statusCode, body: res.body }));
        } catch (e) {
            if (e.statusCode === 410) {
                await inTx(root, async (ctx) => {
                    let t = (await repo.getWebToken(ctx, task.tokenId))!;
                    await handleFail(t);
                });
            }
            log.log(root, 'web_push failed', token.uid, JSON.stringify({ statusCode: e.statusCode, body: e.body }));
            return;
        }
    };

    // Obsolete worker
    let queue = new WorkQueue<WebPushTask>('push_sender_web');
    if (Config.pushWeb) {
        if (serverRoleEnabled('workers')) {
            for (let i = 0; i < 10; i++) {
                queue.addWorker(async (task, root) => {
                    await deliverWebPush(root, task);
                });
            }
        }
    }

    // Better worker
    let betterQueue = new BetterWorkerQueue<WebPushTask>(Store.PushWebDeliveryQueue, { maxAttempts: 3, type: 'external' });
    if (Config.pushWeb) {
        if (serverRoleEnabled('workers')) {
            betterQueue.addWorkers(1000, async (root, task) => {
                await deliverWebPush(root, task);
            });
        }
    }

    return betterQueue;
}