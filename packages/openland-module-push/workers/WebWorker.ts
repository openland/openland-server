import { Config } from 'openland-config/Config';
import WebPush from 'web-push';
import { PushRepository } from 'openland-module-push/repositories/PushRepository';
import { WorkQueue } from 'openland-module-workers/WorkQueue';
import { WebPushTask } from './types';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { handleFail } from './util/handleFail';
import { createHyperlogger } from '../../openland-module-hyperlog/createHyperlogEvent';
import { inTx } from '@openland/foundationdb';
import { createLogger } from '@openland/log';

const log = createLogger('web-push');
const pushSent = createHyperlogger<{ uid: number, tokenId: string }>('push_web_sent');
const pushFail = createHyperlogger<{ uid: number, tokenId: string, failures: number, statusCode: number, disabled: boolean }>('push_web_failed');

export function createWebWorker(repo: PushRepository) {
    let queue = new WorkQueue<WebPushTask>('push_sender_web');
    if (Config.pushWeb) {
        if (serverRoleEnabled('workers')) {
            for (let i = 0; i < 10; i++) {
                queue.addWorker(async (task, root) => {
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
                        await inTx(root, async (ctx) => {
                            pushSent.event(ctx, { uid: token.uid, tokenId: token.id });
                        });
                        log.log(root, 'web_push', token.uid, JSON.stringify({ statusCode: res.statusCode, body: res.body }));
                    } catch (e) {
                        if (e.statusCode === 410) {
                            await inTx(root, async (ctx) => {
                                let t = (await repo.getWebToken(ctx, task.tokenId))!;
                                await handleFail(t);
                                pushFail.event(ctx, { uid: t.uid, tokenId: t.id, failures: t.failures!, statusCode: e.statusCode, disabled: !t.enabled });
                            });
                        }
                        log.log(root, 'web_push failed', token.uid, JSON.stringify({ statusCode: e.statusCode, body: e.body }));
                        return;
                    }
                });
            }
        }
    }
    return queue;
}