import { WorkQueue } from 'openland-module-workers/WorkQueue';
import { FirebasePushTask } from './types';
import { createLogger } from 'openland-log/createLogger';
import * as Friebase from 'firebase-admin';
import { PushRepository } from 'openland-module-push/repositories/PushRepository';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { handleFail } from './util/handleFail';
import { createHyperlogger } from '../../openland-module-hyperlog/createHyperlogEvent';
import { inTx } from '../../foundation-orm/inTx';
import { PushConfig } from 'openland-module-push/PushConfig';
import { createEmptyContext } from 'openland-utils/Context';

const log = createLogger('firebase');
const pushSent = createHyperlogger<{ uid: number, tokenId: string }>('push_firebase_sent');
const pushFail = createHyperlogger<{ uid: number, tokenId: string, failures: number, error: string, disabled: boolean }>('push_firebase_failed');

export function createAndroidWorker(repo: PushRepository) {
    let queue = new WorkQueue<FirebasePushTask, { result: string }>('push_sender_firebase');
    if (PushConfig.google) {
        if (serverRoleEnabled('workers')) {
            let firbaseApps: { [pkg: string]: Friebase.app.App } = {};
            for (let creds of PushConfig.google) {
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
            for (let i = 0; i < 10; i++) {
                queue.addWorker(async (task) => {
                    let root = createEmptyContext();
                    let token = (await repo.getAndroidToken(root, task.tokenId))!;
                    if (!token.enabled) {
                        return { result: 'skipped' };
                    }
                    let firebase = firbaseApps[token.packageId];
                    if (firebase) {
                        try {
                            let res = await firebase.messaging().send({
                                android: {
                                    collapseKey: task.collapseKey,
                                    notification: task.notification,
                                    data: task.data
                                },
                                token: token.token
                            });
                            log.log('android_push', token.uid, res);
                            if (res.includes('messaging/invalid-registration-token') || res.includes('messaging/registration-token-not-registered')) {
                                await inTx(root, async (ctx) => {
                                    let t = (await repo.getAndroidToken(ctx, task.tokenId))!;
                                    await handleFail(t);
                                    await pushFail.event(ctx, { uid: t.uid, tokenId: t.id, failures: t.failures!, error: res, disabled: !t.enabled });
                                });
                            } else {
                                await pushSent.event(root, { uid: token.uid, tokenId: token.id });
                            }
                            return { result: 'ok' };
                        } catch (e) {
                            log.log('android_push failed', token.uid);
                            return { result: 'failed' };
                        }
                    } else {
                        throw Error('');
                    }
                });
            }
        }
    }
    return queue;
}