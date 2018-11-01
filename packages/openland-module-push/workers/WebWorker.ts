import WebPush from 'web-push';
import { PushRepository } from 'openland-module-push/repositories/PushRepository';
import { WorkQueue } from 'openland-module-workers/WorkQueue';
import { WebPushTask } from './types';
import { AppConfiuguration } from 'openland-server/init/initConfig';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { createLogger } from '../../openland-log/createLogger';
import { handleFail } from './util/handleFail';
import { createHyperlogger } from '../../openland-module-hyperlog/createHyperlogEvent';
import { inTx } from '../../foundation-orm/inTx';

const log = createLogger('web_push');
const pushSent = createHyperlogger<{ uid: number, tokenId: string }>('push_web_sent');
const pushFail = createHyperlogger<{ uid: number, tokenId: string, failures: number, statusCode: number, disabled: boolean }>('push_web_failed');

export function createWebWorker(repo: PushRepository) {
    let queue = new WorkQueue<WebPushTask, { result: string }>('push_sender_web');
    if (AppConfiuguration.webPush) {
        if (serverRoleEnabled('workers')) {
            queue.addWorker(async (task) => {
                let token = (await repo.getWebToken(task.tokenId))!;
                if (!token.enabled) {
                    return { result: 'skipped' };
                }

                try {
                    let res = await WebPush.sendNotification(JSON.parse(token.endpoint), JSON.stringify({
                        title: task.title,
                        body: task.body,
                        picture: task.picture,
                        ...task.extras
                    }));
                    await pushSent.event({ uid: token.uid, tokenId: token.id });
                    log.log('web_push', token.uid, JSON.stringify({ statusCode: res.statusCode, body: res.body }));
                } catch (e) {
                    if (e.statusCode === 410) {
                        await inTx(async () => {
                            let t = (await repo.getWebToken(task.tokenId))!;
                            await handleFail(t);
                            await pushFail.event({ uid: t.uid, tokenId: t.id, failures: t.failures!, statusCode: e.statusCode, disabled: !t.enabled });

                        });
                    }
                    log.log('web_push failed', token.uid, JSON.stringify({ statusCode: e.statusCode, body: e.body }));
                    return { result: 'failed' };
                }
                return { result: 'ok' };
            });
        }
    }
    return queue;
}