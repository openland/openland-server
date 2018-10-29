import { WorkQueue } from 'openland-module-workers/WorkQueue';
import { FirebasePushTask } from './types';
import { AppConfiuguration } from 'openland-server/init/initConfig';
import { createLogger } from 'openland-log/createLogger';
import * as Friebase from 'firebase-admin';
import { PushRepository } from 'openland-module-push/repositories/PushRepository';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';

let log = createLogger('firebase');

export function createAndroidWorker(repo: PushRepository) {
    let queue = new WorkQueue<FirebasePushTask, { result: string }>('push_sender_firebase');
    if (AppConfiuguration.google) {
        if (serverRoleEnabled('workers')) {
            let firbaseApps: { [pkg: string]: Friebase.app.App } = {};
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
            queue.addWorker(async (task) => {
                let token = (await repo.getAndroidToken(task.tokenId))!;
                if (!token.enabled) {
                    return { result: 'skipped' };
                }
                let firebase = firbaseApps[token.packageId];
                if (firebase) {
                    let res = await firebase.messaging().send({
                        android: {
                            collapseKey: task.collapseKey,
                            notification: task.notification,
                            data: task.data
                        },
                        token: token.token
                    });
                    log.log('android_push %d', token.uid, res);
                    return { result: 'ok' };
                } else {
                    throw Error('');
                }
            });
        }
    }
    return queue;
}