import { WorkQueue } from '../modules/workerQueue';
import { DB } from '../tables';
import WebPush from 'web-push';

export function createPushWorker() {
    let queue = new WorkQueue<{ uid: number, title: string, body: string }, { result: string }>('push_sender');
    if (process.env.WEB_PUSH_PUBLIC && process.env.WEB_PUSH_PRIVATE) {
        WebPush.setVapidDetails(
            'mailto:support@openland.com',
            process.env.WEB_PUSH_PUBLIC,
            process.env.WEB_PUSH_PRIVATE
        );
        queue.addWorker(async (args, lock) => {
            let registrations = await DB.UserPushRegistration.findAll({
                where: {
                    userId: args.uid
                }
            });
            lock.check();
            for (let reg of registrations) {
                let res = await WebPush.sendNotification(JSON.parse(reg.pushEndpoint), JSON.stringify({
                    title: args.title,
                    body: args.body 
                }));
                console.warn(res);
                // 
            }
            return {
                result: 'ok'
            };
        });
    }
    return queue;
}