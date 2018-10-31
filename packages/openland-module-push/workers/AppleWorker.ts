import APN from 'apn';
import { WorkQueue } from 'openland-module-workers/WorkQueue';
import { ApplePushTask } from './types';
import { AppConfiuguration } from 'openland-server/init/initConfig';
import { createLogger } from 'openland-log/createLogger';
import { PushRepository } from 'openland-module-push/repositories/PushRepository';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';

let providers = new Map<boolean, Map<string, APN.Provider>>();
let log = createLogger('apns');
export function createAppleWorker(repo: PushRepository) {
    let queue = new WorkQueue<ApplePushTask, { result: string }>('push_sender_apns');
    if (AppConfiuguration.apple) {
        if (serverRoleEnabled('workers')) {
            queue.addWorker(async (task) => {
                let token = (await repo.getAppleToken(task.tokenId))!;
                if (!token.enabled) {
                    return { result: 'skipped' };
                }

                let team = AppConfiuguration.apple!.find((v) => v.bundles.indexOf(token.bundleId) >= 0);
                if (team) {
                    if (!providers.has(token.sandbox)) {
                        providers.set(token.sandbox, new Map());
                    }
                    let provs = providers.get(token.sandbox)!!;
                    if (!provs.has(team.teamId)) {
                        provs.set(team.teamId, new APN.Provider({
                            token: {
                                key: Buffer.from(team.key, 'base64'),
                                keyId: team.keyId,
                                teamId: team.teamId
                            },
                            production: !token.sandbox
                        }));
                    }

                    let not = new APN.Notification();
                    not.topic = token.bundleId;
                    not.contentAvailable = task.contentAvailable || false;
                    if (task.badge) {
                        not.badge = task.badge;
                    }
                    if (task.payload) {
                        not.payload = JSON.stringify(task.payload);
                    }
                    if (task.expirity) {
                        not.expiry = task.expirity;
                    }
                    if (task.sound) {
                        not.sound = task.sound;
                    }
                    if (task.alert) {
                        not.alert = task.alert;
                    }

                    try {
                        let res = await (provs.get(team.teamId)!!).send(not, token.token);
                        log.log('ios_push', token.uid, JSON.stringify(res));

                        if (res.failed.length > 0) {
                            let reason = res.failed[0].response && res.failed[0].response!.reason;

                            if (reason === 'BadDeviceToken' || reason === 'Unregistered') {
                                token.enabled = false;
                            }
                        }

                        return { result: 'ok' };
                    } catch (e) {
                        log.log('ios_push failed', token.uid);
                        return { result: 'failed' };
                    }

                } else {
                    throw Error('Unable to find team for bundleId: ' + token.bundleId);
                }
            });
        }
    }
    return queue;
}