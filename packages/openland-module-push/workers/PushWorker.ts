import { IDs } from 'openland-module-api/IDs';
import { WorkQueue } from 'openland-module-workers/WorkQueue';
import { PushRepository } from 'openland-module-push/repositories/PushRepository';
import { Modules } from 'openland-modules/Modules';
import { createTracer } from 'openland-log/createTracer';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { Texts } from '../../openland-module-messaging/texts';
import { withReadOnlyTransaction } from '@openland/foundationdb';

export function doSimpleHash(key: string): number {
    var h = 0, l = key.length, i = 0;
    if (l > 0) {
        while (i < l) {
            h = (h << 5) - h + key.charCodeAt(i++) | 0;
        }
    }
    return Math.abs(h);
}

type Push = {
    uid: number;
    title: string;
    body: string;
    picture: string | null;
    counter: number | null;
    conversationId: number | null;
    deepLink: string | null;
    mobile: boolean;
    desktop: boolean;
    mobileAlert: boolean;
    mobileIncludeText: boolean;
    silent: boolean | null;
};

const tracer = createTracer('push');

export function createPushWorker(repo: PushRepository) {
    let queue = new WorkQueue<Push, { result: string }>('push_sender');
    if (serverRoleEnabled('workers')) {
        for (let i = 0; i < 10; i++) {
            queue.addWorker(async (args, parent) => {
                return tracer.trace(withReadOnlyTransaction(parent), 'sorting', async (ctx) => {
                    let conversationId = args.conversationId ? IDs.Conversation.serialize(args.conversationId) : undefined;
                    let deepLink = args.deepLink;
                    if (args.desktop) {
                        //
                        // Web Push
                        //
                        let webTokens = await repo.getUserWebPushTokens(ctx, args.uid);
                        for (let wp of webTokens) {
                            await Modules.Push.webWorker.pushWork(ctx, {
                                uid: args.uid,
                                tokenId: wp.id,
                                title: args.title,
                                body: args.body,
                                picture: args.picture ? args.picture : undefined,
                            });
                        }

                        let safariTokens = await repo.getUserSafariPushTokens(ctx, args.uid);
                        for (let t of safariTokens) {
                            await Modules.Push.appleWorker.pushWork(ctx, {
                                uid: args.uid,
                                tokenId: t.id,
                                contentAvailable: true,
                                alert: {
                                    title: args.title,
                                    body: args.body,
                                },
                                payload: {
                                    conversationId,
                                    deepLink,
                                    ['id']: args.conversationId ? doSimpleHash(IDs.Conversation.serialize(args.conversationId)).toString() : undefined,
                                    ...(args.picture ? { ['picture']: args.picture! } : {}),
                                },
                            });
                        }
                    }
                    if (args.mobile) {
                        let unread = await Modules.Messaging.fetchUserGlobalCounter(ctx, args.uid);
                        if (await Modules.Wallet.isLocked(ctx, args.uid)) {
                            unread++;
                        }

                        let mobileBody = args.mobileIncludeText ? args.body : Texts.Notifications.NEW_MESSAGE_ANONYMOUS;
                        //
                        // iOS
                        //
                        let iosTokens = await repo.getUserApplePushTokens(ctx, args.uid);
                        for (let t of iosTokens) {
                            if (args.silent) {
                                await Modules.Push.appleWorker.pushWork(ctx, {
                                    uid: args.uid,
                                    tokenId: t.id,
                                    contentAvailable: true,
                                    badge: unread,
                                    payload: {
                                        conversationId,
                                        deepLink,
                                        ['id']: args.conversationId ? doSimpleHash(IDs.Conversation.serialize(args.conversationId)).toString() : undefined,
                                    },
                                });
                            } else {
                                await Modules.Push.appleWorker.pushWork(ctx, {
                                    uid: args.uid,
                                    tokenId: t.id,
                                    sound: args.mobileAlert ? 'default' : undefined,
                                    contentAvailable: true,
                                    badge: unread,
                                    alert: {
                                        title: args.title,
                                        body: mobileBody,
                                    },
                                    payload: {
                                        conversationId,
                                        deepLink,
                                        ['title']: args.title,
                                        ['message']: mobileBody,
                                        ['id']: args.conversationId ? doSimpleHash(IDs.Conversation.serialize(args.conversationId)).toString() : undefined,
                                        ...(args.picture ? { ['picture']: args.picture! } : {}),
                                    },
                                });
                            }
                        }

                        //
                        // Android
                        //

                        let androidTokens = await repo.getUserAndroidPushTokens(ctx, args.uid);
                        for (let token of androidTokens) {
                            if (args.silent) {
                                await Modules.Push.androidWorker.pushWork(ctx, {
                                    uid: args.uid,
                                    isData: true,
                                    data: {
                                        ['unread']: unread.toString(),
                                    },
                                    tokenId: token.token
                                });

                                continue;
                            }
                            await Modules.Push.androidWorker.pushWork(ctx, {
                                uid: args.uid,
                                tokenId: token.id,
                                collapseKey: conversationId,
                                notification: {
                                    title: args.title,
                                    body: mobileBody,
                                    sound: args.mobileAlert ? 'default' : 'silence.mp3',
                                    tag: conversationId,
                                },
                                data: {
                                    ['title']: args.title,
                                    ['message']: mobileBody,
                                    ['unread']: unread.toString(),
                                    ['soundName']: args.mobileAlert ? 'default' : 'silence.mp3',
                                    // ['color']: '#4747EC',
                                    ...(args.picture ? { ['picture']: args.picture! } : {}),
                                    ...(args.deepLink ? { deepLink } as any : {}),
                                    ...(args.conversationId ? { conversationId } as any : {}),
                                    ...(args.conversationId ? { ['id']: doSimpleHash(IDs.Conversation.serialize(args.conversationId)).toString() } : {}),
                                },
                            });
                        }
                    }

                    return {
                        result: 'ok',
                    };
                });
            });
        }
    }
    return queue;
}