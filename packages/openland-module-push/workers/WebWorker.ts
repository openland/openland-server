import WebPush from 'web-push';
import { PushRepository } from 'openland-module-push/repositories/PushRepository';
import { WorkQueue } from 'openland-module-workers/WorkQueue';
import { WebPushTask } from './types';
import { AppConfiuguration } from 'openland-server/init/initConfig';

export function createWebWorker(repo: PushRepository) {
    let queue = new WorkQueue<WebPushTask, { result: string }>('push_sender_web');
    if (AppConfiuguration.webPush) {
        queue.addWorker(async (task) => {
            let token = (await repo.getWebToken(task.tokenId))!;
            if (!token.enabled) {
                return { result: 'skipped' };
            }

            try {
                await WebPush.sendNotification(JSON.parse(token.endpoint), JSON.stringify({
                    title: task.title,
                    body: task.body,
                    picture: task.picture,
                    ...task.extras
                }));
            } catch (e) {
                return { result: 'failed' };
            }
            return { result: 'ok' };
        });
    }
    return queue;
}