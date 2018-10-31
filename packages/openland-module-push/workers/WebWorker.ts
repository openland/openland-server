import WebPush from 'web-push';
import { PushRepository } from 'openland-module-push/repositories/PushRepository';
import { WorkQueue } from 'openland-module-workers/WorkQueue';
import { WebPushTask } from './types';
import { AppConfiuguration } from 'openland-server/init/initConfig';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { createLogger } from '../../openland-log/createLogger';

let log = createLogger('apns');
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
                    log.log('web_push', token.uid, JSON.stringify({ statusCode: res.statusCode, body: res.body }));
                } catch (e) {
                    log.log('web_push failed', token.uid);
                    return { result: 'failed' };
                }
                return { result: 'ok' };
            });
        }
    }
    return queue;
}