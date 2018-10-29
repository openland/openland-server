import { IDs } from 'openland-server/api/utils/IDs';
import { Texts } from 'openland-server/texts';
import { WorkQueue } from 'openland-module-workers/WorkQueue';
import { PushRepository } from 'openland-module-push/repositories/PushRepository';
import { Modules } from 'openland-modules/Modules';
import { withTracing } from 'openland-log/withTracing';
import { createTracer } from 'openland-log/createTracer';

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
    counter: number;
    conversationId: number;
    mobile: boolean;
    desktop: boolean;
    mobileAlert: boolean;
    mobileIncludeText: boolean;
    silent: boolean | null;
};

const tracer = createTracer('push');

export function createPushWorker(repo: PushRepository) {
    let queue = new WorkQueue<Push, { result: string }>('push_sender');
    queue.addWorker(async (args) => {
        return await withTracing(tracer, 'task', async () => {
            //
            // Web Push
            //

            let webTokens = await repo.getUserWebPushTokens(args.uid);
            for (let wp of webTokens) {
                await Modules.Push.webWorker.pushWork({
                    tokenId: wp.id,
                    title: args.title,
                    body: args.body,
                    picture: args.picture ? args.picture : undefined,
                });
            }

            if (args.mobile) {
                let mobileBody = args.mobileIncludeText ? args.body : Texts.Notifications.NEW_MESSAGE_ANONYMOUS;

                //
                // iOS
                //
                let iosTokens = await repo.getUserApplePushTokens(args.uid);
                for (let t of iosTokens) {
                    if (args.silent) {
                        await Modules.Push.appleWorker.pushWork({
                            tokenId: t.id,
                            contentAvailable: true,
                            badge: args.counter,
                            payload: {
                                ['conversationId']: IDs.Conversation.serialize(args.conversationId),
                                ['id']: doSimpleHash(IDs.Conversation.serialize(args.conversationId)).toString()
                            }
                        });
                    } else {
                        await Modules.Push.appleWorker.pushWork({
                            tokenId: t.id,
                            sound: args.mobileAlert ? 'default' : undefined,
                            contentAvailable: true,
                            badge: args.counter,
                            alert: {
                                title: args.title,
                                body: mobileBody
                            },
                            payload: {
                                ['conversationId']: IDs.Conversation.serialize(args.conversationId),
                                ['title']: args.title,
                                ['message']: mobileBody,
                                ['id']: doSimpleHash(IDs.Conversation.serialize(args.conversationId)).toString(),
                                ...(args.picture ? { ['picture']: args.picture! } : {}),
                            }
                        });
                    }
                }

                //
                // Android
                //

                let androidTokens = await repo.getUserAndroidPushTokens(args.uid);
                for (let token of androidTokens) {
                    await Modules.Push.androidWorker.pushWork({
                        tokenId: token.id,
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
                    });
                }
            }

            return {
                result: 'ok'
            };
        });
    });
    return queue;
}