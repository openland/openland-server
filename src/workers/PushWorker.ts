import { WorkQueue } from '../modules/workerQueue';
import { DB } from '../tables';
import WebPush from 'web-push';
import { AppConfiuguration } from '../init/initConfig';
import APN from 'apn';
import * as Friebase from 'firebase-admin';
import { IDs } from '../api/utils/IDs';
import { doSimpleHash } from '../utils/hash';

let providers = new Map<boolean, Map<string, APN.Provider>>();

export function createPushWorker() {
    let queue = new WorkQueue<{ uid: number, title: string, body: string, picture: string | null, counter: number, conversationId: number, mobile: boolean }, { result: string }>('push_sender');
    if (AppConfiuguration.webPush || AppConfiuguration.apple) {
        console.log('Starting push worker');

        let firebase = Friebase.initializeApp({
            credential: Friebase.credential.cert({
                privateKey: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCbEvgNbgpuEebR\nvFFc5rYN44o8Gd2jMyY8aSFmG+6ehfg2zlCUHxMRCEMD6f7xDZqPOs5sAdQbOqB/\n6lxHATFLLwn70c8PUDWhB6RqjdeTkfbEiYGiq/hfXOl5DxvUo/q6rHNru/ANAxKa\n/1XiE5fNm4TZYz5x3703aCH9aNRSFE5uPF6ih0v7ZfY3K/B95chOy/a6EFJbELeV\nmOpUM77sWymDALCZfKDsHCs1uUbsfEkmer2pyM+xYxChRLYIcpBTNl24wYZzIask\n1yzJr/MWb5lPt/MWOGS4hd6DuWnnZL0/WbIZidXCcDd7oYNldFAoAXOOM3qb3WzZ\nYvOgqxW3AgMBAAECggEAF5v2C0gN6x9rQ9KRlJJEygKIFjRd663VjBb5ZcFU5+o/\nlaB9i2oxDe5zEtJ6OkWMRXLPizQQEIExfv1gRSh8/RRRRyHJ42vzw5YVRb+zQB1V\n3irig1tT5Ljm4W5tGfJJMZ3LCMOZKByn+tRq7+YfE3IyR00hFwHYSJTgWo4Dh+dL\ndc/gLKrqatX5EMy3HQC8O+3WGK9y2FzsIAZhmcz0LpoAhdYeCzFWO4vmE02EdVit\nNgRiP0QqFP0Rz0kGQRckZqGxbkNGqX/Ptj9ApJ1819A245i04eaFWxzH5DEzuIzv\nSZoYAk0IQvueiZud6i40DgTnDu5Ax0QxT822lBVx8QKBgQDRuke/FFdKrt93CGzr\n5EXoSmwZKMWwQ1PogOXcq1ZscW/5r0DwtT8rJDjTxq1qgm28ASqG3bmrrodtyJmY\n9Ml/AiQX3XSBTTSW2CPmMZ9FcZDI36g/UyR3IXE92z02jxDdHjVlhbxnw4OUu+Ox\nE5OCyiyzUGl/Y8r6nH/9rnjB7wKBgQC9ScbrXgsmhFZMPdjJ50akNcEhtWCbnWRz\nIo74wLhb6GTIOiOyRtTRlevelSzLQvgAWtp5driQYjjlo+vXdzEokWivYLEwKgKz\n9qe5Z7/E4b7ADl5jr+bIIaBh/sJ8mCv9uWZIV6KRSpLdVfyXcQgYOGO8skYRR4+u\nioiRnTgQuQKBgEzJkllAnlFGw6S2XgLkOkA5d2iix/aoQAGBqCdqSCM+SUw2wWUg\nRzeJdJD9TiMQDBNoreRhLAjSxt0INEyPW3L4GrTuLSjmVpngGwy+IF1xnhwd32EI\nFPLVOLv4GGpwaTE8TTqVg4zORc/gFxaPX1PkqAcjKu0sYXXudOIxzh7bAoGANAj0\nBf/0UMJQduUJk3dglAOy8/FIfX7m/j+hzgAsrhdUnTZeWcPe/T6ZeLbJeZcPVgmj\nxYA9fHOD8Jz/WFwLx3sxrASIsRTbaV2E/hLnRNhJ98H7cKwKZTnZPRcrn9S1QyqU\nU47Dwe0eMnpQ1dDcyMu3n0fiux1RAkpTALSXlQECgYEAznQuoA6RRGqnR5RT3qxw\n/5a71v8bQlHkcRYmF/tQ5JRtvs4rOzgfQddR62ONw8wPJ7+ixkX/3SubrcUbuDy+\nt0KBZ5hmFj3wEMHISiCqkUwzCivN0I7H7m1wv70ma4wweCsorv/RY9jrMlQmQn83\nUavd9VUtNprGRqLOWUCrPYA=\n-----END PRIVATE KEY-----\n',
                projectId: 'actor-51469',
                clientEmail: 'firebase-adminsdk-5gipf@actor-51469.iam.gserviceaccount.com'
            }),
            databaseURL: 'https://actor-51469.firebaseio.com'
        });
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
                    if (!args.mobile) {
                        continue;
                    }
                    try {
                        let endpoint = JSON.parse(reg.pushEndpoint);
                        let bundleId = endpoint.bundleId as string;
                        let token = endpoint.token as string;
                        let isSandbox = endpoint.sandbox as boolean;
                        let team = AppConfiuguration.apple.find((v) => v.bundles.indexOf(bundleId) >= 0);
                        if (team) {
                            if (!providers.has(isSandbox)) {
                                providers.set(isSandbox, new Map());
                            }
                            let provs = providers.get(isSandbox)!!;
                            if (!provs.has(team.teamId)) {
                                provs.set(team.teamId, new APN.Provider({
                                    token: {
                                        key: Buffer.from(team.key, 'base64'),
                                        keyId: team.keyId,
                                        teamId: team.teamId
                                    },
                                    production: !isSandbox
                                }));
                            }
                            var not = new APN.Notification();
                            not.expiry = Math.floor(Date.now() / 1000) + 3600;
                            not.alert = { title: args.title, body: args.body };
                            not.badge = args.counter;
                            not.topic = bundleId;
                            let res = await (provs.get(team.teamId)!!).send(not, token);
                            console.log(JSON.stringify(res));
                        } else {
                            console.warn('Unable to match bundle id ' + bundleId);
                            console.warn(AppConfiuguration.apple);
                        }
                    } catch (e) {
                        // Fast ignore for push notifications
                        console.warn(e);
                    }
                } else if (reg.pushType === 'android') {
                    if (!args.mobile) {
                        continue;
                    }
                    try {
                        let endpoint = JSON.parse(reg.pushEndpoint);
                        let token = endpoint.token as string;

                        let res = await firebase.messaging().send(
                            {
                                notification: {
                                    title: args.title,
                                    body: args.body,
                                },
                                data: {
                                    ['conversationId']: IDs.Conversation.serialize(args.conversationId),
                                    ['title']: args.title,
                                    ['message']: args.body,
                                    ['id']: doSimpleHash(IDs.Conversation.serialize(args.conversationId)).toString(),
                                },
                                token: token
                            }
                        );

                        console.log('push_android', res);
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