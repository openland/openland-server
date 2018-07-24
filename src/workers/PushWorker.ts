import { WorkQueue } from '../modules/workerQueue';
import { DB } from '../tables';
import WebPush from 'web-push';

export function createPushWorker() {
    let queue = new WorkQueue<{ uid: number, title: string, body: string, picture: string | null, }, { result: string }>('push_sender');
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
                if (reg.pushType === 'web-push') {
                    try {
                        await WebPush.sendNotification(JSON.parse(reg.pushEndpoint), JSON.stringify({
                            title: args.title,
                            body: args.body,
                            picture: args.picture
                        }));
                    } catch (e) {
                        // Fast ignore for push notifications
                        console.warn(e);
                    }
                }
            }
            return {
                result: 'ok'
            };
        });
    }
    return queue;
}