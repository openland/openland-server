import { WorkQueue } from '../modules/workerQueue';
import { DB } from '../tables';
import WebPush from 'web-push';
import { AppConfiuguration } from '../init/initConfig';
import APN from 'apn';

let providers = new Map<string, APN.Provider>();

export function createPushWorker() {
    let queue = new WorkQueue<{ uid: number, title: string, body: string, picture: string | null, }, { result: string }>('push_sender');
    if (AppConfiuguration.webPush || AppConfiuguration.apple) {
        console.log('Starting push worker');
        queue.addWorker(async (args, lock) => {
            let registrations = await DB.UserPushRegistration.findAll({
                where: {
                    userId: args.uid
                }
            });
            lock.check();
            for (let reg of registrations) {
                if (reg.pushType === 'web-push' && AppConfiuguration.webPush) {
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
                } else if (reg.pushType === 'ios' && AppConfiuguration.apple) {
                    try {
                        let endpoint = JSON.parse(reg.pushEndpoint);
                        let bundleId = endpoint.bundleId as string;
                        let token = endpoint.token as string;
                        let isSandbox = endpoint.sandbox as string;
                        // Ignore production for now
                        if (!isSandbox) {
                            continue;
                        }
                        let team = AppConfiuguration.apple.find((v) => v.bundles.indexOf(bundleId) >= 0);
                        if (team) {
                            if (!providers.has(team.teamId)) {
                                providers.set(team.teamId, new APN.Provider({
                                    token: {
                                        key: Buffer.from(team.key, 'base64'),
                                        keyId: team.keyId,
                                        teamId: team.teamId
                                    }
                                }));
                            }
                            var not = new APN.Notification();
                            not.expiry = Math.floor(Date.now() / 1000) + 3600;
                            not.alert = { title: args.title, body: args.body };
                            not.topic = bundleId;
                            let res = await (providers.get(team.teamId)!!).send(not, token);
                            console.log(JSON.stringify(res));
                        } else {
                            console.warn('Unable to match bundle id ' + bundleId);
                            console.warn(AppConfiuguration.apple);
                        }
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
    } else {
        console.warn('Unable to start push worker');
        console.log(AppConfiuguration);
    }
    return queue;
}