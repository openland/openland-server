import { inTx } from '@openland/foundationdb';
import { createNamedContext } from '@openland/context';
import { Pubsub } from 'openland-module-pubsub/pubsub';
import { broker } from 'openland-server/moleculer';
import { GQLRoots } from 'openland-module-api/schema/SchemaRoots';
import TypingTypeRoot = GQLRoots.TypingTypeRoot;
import { TypingEvent } from 'openland-module-typings/TypingEvent';
import { Shutdown } from 'openland-utils/Shutdown';
import { Modules } from 'openland-modules/Modules';

const rootCtx = createNamedContext('typings');

export function registerTypingsService(xPubSub: Pubsub<TypingEvent>) {
    const cache = new Map<number, number[]>();
    let timer = setInterval(() => cache.clear(), 1000 * 30);
    Shutdown.registerWork({
        name: 'typings-service',
        shutdown: async () => {
            clearInterval(timer);
        }
    });
    let getChatMembers = async (chatId: number): Promise<number[]> => {
        if (cache.has(chatId)) {
            return cache.get(chatId)!;
        } else {
            let mem = await inTx(rootCtx, async (ctx) => {
                return await Modules.Messaging.room.findConversationMembers(ctx, chatId);
            });
            if (!cache.has(chatId)) {
                cache.set(chatId, mem);
                return mem;
            } else {
                return cache.get(chatId)!;
            }
        }
    };

    broker.createService({
        name: 'typings',
        actions: {
            send: {
                name: 'send',
                strategy: 'Shard',
                strategyOptions: {
                    shardKey: 'cid'
                },
                handler: async (ctx) => {
                    let uid = ctx.params.uid as number;
                    let cid = ctx.params.cid as number;
                    let type = ctx.params.type as TypingTypeRoot;

                    let allPosts = (await getChatMembers(cid)).map(async (v) => {
                        await xPubSub.publish(`TYPING_${v}`, {
                            forUserId: v,
                            userId: uid,
                            conversationId: cid,
                            type,
                            cancel: type === 'cancel'
                        });
                    });
                    await Promise.all(allPosts);
                }
            }
        }
    });
}