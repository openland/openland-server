import { Context } from '@openland/context';
import { Config } from 'openland-config/Config';
import { FirebasePushTask } from './types';
import * as Friebase from 'firebase-admin';
import { PushRepository } from 'openland-module-push/repositories/PushRepository';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { handleFail } from './util/handleFail';
import { inHybridTx, inTx } from '@openland/foundationdb';
// import { createLogger } from '@openland/log';
import { BetterWorkerQueue } from 'openland-module-workers/BetterWorkerQueue';
import { Store } from 'openland-module-db/FDB';

// const log = createLogger('firebase');

export function createAndroidWorker(repo: PushRepository) {
    let betterQueue = new BetterWorkerQueue<FirebasePushTask>(Store.PushFirebaseDeliveryQueue, { type: 'external', maxAttempts: 3 });
    if (Config.pushGoogle) {
        if (serverRoleEnabled('workers')) {
            let firbaseApps: { [pkg: string]: Friebase.app.App } = {};
            for (let creds of Config.pushGoogle.accounts) {
                for (let pkg of creds.packages) {
                    firbaseApps[pkg] = Friebase.initializeApp({
                        credential: Friebase.credential.cert({
                            privateKey: creds.key.private_key,
                            projectId: creds.key.project_id,
                            clientEmail: creds.key.client_email
                        }),
                        databaseURL: creds.endpoint
                    }, pkg);
                }
            }

            let handlePush = async (root: Context, task: FirebasePushTask) => {
                let token = (await inTx(root, async ctx => await repo.getAndroidToken(ctx, task.tokenId)))!;
                if (!token || !token.enabled) {
                    return;
                }
                let firebase = firbaseApps[token.packageId];
                if (firebase) {
                    try {
                        let res: any;
                        if (task.isData) {
                            res = await firebase.messaging().send({
                                data: task.data,
                                android: {
                                    priority: 'high'
                                },
                                token: token.token
                            });
                        } else {
                            res = await firebase.messaging().send({
                                android: {
                                    collapseKey: task.collapseKey,
                                    notification: task.notification,
                                    data: task.data,
                                    priority: 'high'
                                },
                                token: token.token
                            });
                        }

                        // log.log(root, 'android_push', token.uid, res);
                        if (res.includes('messaging/invalid-registration-token') || res.includes('messaging/registration-token-not-registered')) {
                            await inTx(root, async (ctx) => {
                                let t = (await repo.getAndroidToken(ctx, task.tokenId))!;
                                await handleFail(t);
                            });
                        }
                        return;
                    } catch (e) {
                        // log.log(root, 'android_push failed', token.uid);
                        return;
                    }
                } else {
                    await inTx(root, async (ctx) => {
                        let t = (await repo.getAndroidToken(ctx, task.tokenId))!;
                        await handleFail(t);
                    });
                    return;
                }
            };

            betterQueue.addWorkers(1000, async (root, task) => {
                await inHybridTx(root, async ctx => {
                    await handlePush(ctx, task);
                });
            });
        }
    }
    return betterQueue;
}