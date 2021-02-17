import { IDs } from 'openland-module-api/IDs';
import { PushRepository } from 'openland-module-push/repositories/PushRepository';
import { Modules } from 'openland-modules/Modules';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { Texts } from '../../openland-module-messaging/texts';
import { Context } from '@openland/context';
import { BetterWorkerQueue } from 'openland-module-workers/BetterWorkerQueue';
import { Store } from 'openland-module-db/FDB';
import { withLogPath } from '@openland/log';

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
    messageId: string | null;
    commentId: string | null;
};

async function handlePush(root: Context, repo: PushRepository, push: Push) {
    let ctx = withLogPath(root, 'user ' + push.uid);

    let conversationId = push.conversationId ? IDs.Conversation.serialize(push.conversationId) : undefined;
    let deepLink = push.deepLink;
    if (push.desktop) {
        //
        // Web Push
        //
        let webTokens = await repo.getUserWebPushTokens(ctx, push.uid);
        for (let wp of webTokens) {
            Modules.Push.webWorker.pushWork(ctx, {
                uid: push.uid,
                tokenId: wp.id,
                title: push.title,
                body: push.body,
                picture: push.picture ? push.picture : undefined,
            });
        }

        let safariTokens = await repo.getUserSafariPushTokens(ctx, push.uid);
        for (let t of safariTokens) {
            Modules.Push.appleWorker.pushWork(ctx, {
                uid: push.uid,
                tokenId: t.id,
                contentAvailable: true,
                alert: {
                    title: push.title,
                    body: push.body,
                },
                payload: {
                    conversationId,
                    deepLink,
                    ['id']: push.conversationId ? doSimpleHash(IDs.Conversation.serialize(push.conversationId)).toString() : undefined,
                    ...(push.picture ? { ['picture']: push.picture! } : {}),
                    messageId: push.messageId,
                    commentId: push.commentId
                },
            });
        }
    }
    if (push.mobile) {
        let unread = await Modules.Messaging.counters.fetchUserGlobalCounter(ctx, push.uid);
        if (await Modules.Wallet.isLocked(ctx, push.uid)) {
            unread++;
        }

        let mobileBody = push.mobileIncludeText ? push.body : Texts.Notifications.NEW_MESSAGE_ANONYMOUS;
        //
        // iOS
        //
        let iosTokens = await repo.getUserApplePushTokens(ctx, push.uid);
        for (let t of iosTokens) {
            if (push.silent) {
                Modules.Push.appleWorker.pushWork(ctx, {
                    uid: push.uid,
                    tokenId: t.id,
                    contentAvailable: true,
                    // badge: unread,
                    payload: {
                        conversationId,
                        deepLink,
                        ['id']: push.conversationId ? doSimpleHash(IDs.Conversation.serialize(push.conversationId)).toString() : undefined,
                        messageId: push.messageId,
                        commentId: push.commentId
                    },
                });
            } else {
                Modules.Push.appleWorker.pushWork(ctx, {
                    uid: push.uid,
                    tokenId: t.id,
                    sound: push.mobileAlert ? 'default' : undefined,
                    contentAvailable: true,
                    badge: unread,
                    alert: {
                        title: push.title,
                        body: mobileBody,
                    },
                    payload: {
                        conversationId,
                        deepLink,
                        ['title']: push.title,
                        ['message']: mobileBody,
                        ['id']: push.conversationId ? doSimpleHash(IDs.Conversation.serialize(push.conversationId)).toString() : undefined,
                        ...(push.picture ? { ['picture']: push.picture! } : {}),
                        messageId: push.messageId,
                        commentId: push.commentId
                    },
                });
            }
        }

        //
        // Android
        //

        let androidTokens = await repo.getUserAndroidPushTokens(ctx, push.uid);
        for (let token of androidTokens) {
            if (push.silent) {
                Modules.Push.androidWorker.pushWork(ctx, {
                    uid: push.uid,
                    isData: true,
                    data: {
                        ['unread']: unread.toString(),
                        ...(push.messageId ? { messageId: push.messageId } : {}),
                        ...(push.commentId ? { commentId: push.commentId } : {}),
                    },
                    tokenId: token.token
                });

                continue;
            }
            Modules.Push.androidWorker.pushWork(ctx, {
                uid: push.uid,
                tokenId: token.id,
                collapseKey: conversationId,
                notification: {
                    title: push.title,
                    body: mobileBody,
                    sound: push.mobileAlert ? 'default' : 'silence.mp3',
                    tag: conversationId,
                },
                data: {
                    ['title']: push.title,
                    ['message']: mobileBody,
                    ['unread']: unread.toString(),
                    ['soundName']: push.mobileAlert ? 'default' : 'silence.mp3',
                    // ['color']: '#4747EC',
                    ...(push.picture ? { ['picture']: push.picture! } : {}),
                    ...(push.deepLink ? { deepLink } as any : {}),
                    ...(push.conversationId ? { conversationId } as any : {}),
                    ...(push.conversationId ? { ['id']: doSimpleHash(IDs.Conversation.serialize(push.conversationId)).toString() } : {}),
                    ...(push.messageId ? { messageId: push.messageId } : {}),
                    ...(push.commentId ? { commentId: push.commentId } : {}),
                },
            });
        }
    }
}

export function createPushWorker(repo: PushRepository) {
    let betterQueue = new BetterWorkerQueue<Push>(Store.PushDeliveryQueue, { type: 'transactional', maxAttempts: 3 });

    if (serverRoleEnabled('workers')) {
        // New
        betterQueue.addWorkers(1000, async (parent, args) => {
            await handlePush(parent, repo, args);
        });
    }
    return betterQueue;
}