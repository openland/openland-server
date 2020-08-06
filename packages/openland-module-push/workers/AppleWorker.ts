import { Context } from '@openland/context';
import APN from 'apn';
import { Config } from 'openland-config/Config';
import { WorkQueue } from 'openland-module-workers/WorkQueue';
import { ApplePushTask } from './types';
import { PushRepository } from 'openland-module-push/repositories/PushRepository';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { handleFail } from './util/handleFail';
import { inTx } from '@openland/foundationdb';
import { createLogger } from '@openland/log';
import { BetterWorkerQueue } from 'openland-module-workers/BetterWorkerQueue';
import { Store } from 'openland-module-db/FDB';

let providers = new Map<boolean, Map<string, APN.Provider>>();
const log = createLogger('apns');

export function createAppleWorker(repo: PushRepository) {
    let queue = new WorkQueue<ApplePushTask>('push_sender_apns');
    let betterQueue = new BetterWorkerQueue<ApplePushTask>(Store.PushAppleDeliveryQueue, { type: 'external', maxAttempts: 3 });
    if (Config.pushApple) {
        if (serverRoleEnabled('workers')) {

            let handlePush = async (task: ApplePushTask, root: Context) => {
                let token = await inTx(root, async (ctx) => await repo.getAppleToken(ctx, task.tokenId));
                if (!token || !token.enabled) {
                    return;
                }

                let team = Config.pushApple!.teams!.find((v) => v.bundles.indexOf(token!.bundleId) >= 0);
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
                    if (task.badge !== undefined && task.badge !== null) {
                        not.badge = task.badge;
                    }
                    if (task.payload) {
                        not.payload = task.payload;
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
                    if (task.payload && task.payload.conversationId) {
                        not.threadId = task.payload.conversationId;
                    }

                    try {
                        let res = await (provs.get(team.teamId)!!).send(not, token.token);
                        // log.log(root, 'ios_push', token.uid, JSON.stringify(res));

                        if (res.failed.length > 0) {
                            let reason = res.failed[0].response && res.failed[0].response!.reason;

                            if (reason === 'BadDeviceToken' || reason === 'Unregistered') {
                                await inTx(root, async (ctx) => {
                                    let t = (await repo.getAppleToken(ctx, task.tokenId))!;
                                    await handleFail(t);
                                });
                            }
                        }
                        return;
                    } catch (e) {
                        log.warn(root, 'ios_push exception', e);
                        log.log(root, 'ios_push failed', token.uid);
                        return;
                    }

                } else {
                    await inTx(root, async (ctx) => {
                        let t = (await repo.getAppleToken(ctx, task.tokenId))!;
                        await handleFail(t);
                    });
                    return;
                }
            };

            for (let i = 0; i < 10; i++) {
                queue.addWorker(async (task, root) => {
                    await handlePush(task, root);
                });
            }

            betterQueue.addWorkers(1000, async (root, task) => {
                await handlePush(task, root);
            });
        }
    }
    return betterQueue;
}