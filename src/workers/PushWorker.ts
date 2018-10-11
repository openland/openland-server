import { WorkQueue } from '../modules/workerQueue';
import { DB } from '../tables';
import WebPush from 'web-push';
import { AppConfiuguration } from '../init/initConfig';
import APN from 'apn';
import * as Friebase from 'firebase-admin';
import { IDs } from '../api/utils/IDs';
import { doSimpleHash } from '../utils/hash';
import { Texts } from '../texts';
import { Transaction } from 'sequelize';
import { PushWorker } from './index';

let providers = new Map<boolean, Map<string, APN.Provider>>();

type Push = {
    uid: number;
    title: string;
    body: string;
    picture: string | null;
    counter: number;
    conversationId: number;
    mobile: boolean;
    desktop: boolean;
    mobileAlert: boolean;
    mobileIncludeText: boolean;
    silent: boolean | null;
};

export function sendCounterPush(uid: number, conversationId: number, counter: number, tx: Transaction) {
    return PushWorker.pushWork({
        uid: uid,
        counter: counter,
        conversationId: conversationId,
        mobile: true,
        desktop: false,
        picture: null,
        silent: true,
        title: '',
        body: '',
        mobileAlert: false,
        mobileIncludeText: false
    }, tx);
}

export function createPushWorker() {
    let queue = new WorkQueue<Push, { result: string }>('push_sender');
    if (AppConfiuguration.webPush || AppConfiuguration.apple || AppConfiuguration.google) {
        console.log('Starting push worker');

        let firbaseApps: { [pkg: string]: Friebase.app.App } = {};

        if (AppConfiuguration.google) {
            for (let creds of AppConfiuguration.google) {
                for (let pkg of creds.packages) {
                    firbaseApps[pkg] = Friebase.initializeApp({
                        credential: Friebase.credential.cert({
                            privateKey: creds.privateKey,
                            projectId: creds.projectId,
                            clientEmail: creds.clientEmail
                        }),
                        databaseURL: creds.databaseURL
                    }, pkg);
                }
            }
        }

        queue.addWorker(async (args, lock) => {
            let registrations = await DB.UserPushRegistration.findAll({
                where: {
                    userId: args.uid
                }
            });
            lock.check();

            let mobileBody = args.mobileIncludeText ? args.body : Texts.Notifications.NEW_MESSAGE_ANONYMOUS;

            for (let reg of registrations) {
                if (reg.pushType === 'web-push' && AppConfiuguration.webPush) {
                    if (!args.mobile) {
                        continue;
                    }
                    try {
                        let res = await WebPush.sendNotification(JSON.parse(reg.pushEndpoint), JSON.stringify({
                            title: args.title,
                            body: args.body,
                            picture: args.picture,
                            conversationId: IDs.Conversation.serialize(args.conversationId)
                        }));

                        console.log('web_push %d', args.uid, res);
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

                            if (args.silent) {
                                let not = new APN.Notification();
                                not.contentAvailable = true;
                                not.badge = args.counter;
                                not.payload = JSON.stringify({
                                    ['conversationId']: IDs.Conversation.serialize(args.conversationId),
                                    ['id']: doSimpleHash(IDs.Conversation.serialize(args.conversationId)).toString(),
                                });
                                not.topic = bundleId;
                                let res = await (provs.get(team.teamId)!!).send(not, token);
                                console.log('ios_service_push %d', args.uid, JSON.stringify(res));
                            } else {
                                let not = new APN.Notification();
                                if (args.mobileAlert === true) {
                                    not.sound = 'default';
                                }
                                not.expiry = Math.floor(Date.now() / 1000) + 3600;
                                not.alert = {
                                    title: args.title,
                                    body: mobileBody
                                };
                                not.badge = args.counter;
                                // not.collapseId = IDs.Conversation.serialize(args.conversationId);
                                not.payload = JSON.stringify({
                                    ['conversationId']: IDs.Conversation.serialize(args.conversationId),
                                    ['title']: args.title,
                                    ['message']: mobileBody,
                                    ['id']: doSimpleHash(IDs.Conversation.serialize(args.conversationId)).toString(),
                                    ...(args.picture ? { ['picture']: args.picture! } : {}),
                                });
                                not.topic = bundleId;
                                let res = await (provs.get(team.teamId)!!).send(not, token);
                                console.log('ios_push %d', args.uid, JSON.stringify(res));
                            }
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
                        let bundleId = endpoint.bundleId as string;

                        let token = endpoint.token as string;

                        let firebase = firbaseApps[bundleId];
                        if (firebase) {
                            let res = await firebase.messaging().send({
                                android: {
                                    collapseKey: IDs.Conversation.serialize(args.conversationId),
                                    notification: {
                                        title: args.title,
                                        body: mobileBody,
                                        sound: args.mobileAlert ? 'default' : 'silence.mp3',
                                        tag: IDs.Conversation.serialize(args.conversationId)
                                    },
                                    data: {
                                        ['conversationId']: IDs.Conversation.serialize(args.conversationId),
                                        ['title']: args.title,
                                        ['message']: mobileBody,
                                        ['soundName']: args.mobileAlert ? 'default' : 'silence.mp3',
                                        ['id']: doSimpleHash(IDs.Conversation.serialize(args.conversationId)).toString(),
                                        ['color']: '#4747EC',
                                        ...(args.picture ? { ['picture']: args.picture! } : {}),
                                    }
                                },
                                token: token
                            });
                            console.log('android_push %d', args.uid, res);
                        } else {
                            console.warn('android_push no credentials for package ' + bundleId);
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