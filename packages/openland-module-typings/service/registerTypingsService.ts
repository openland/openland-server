import { inTx } from '@openland/foundationdb';
import { createNamedContext } from '@openland/context';
import { Pubsub } from 'openland-module-pubsub/pubsub';
import { broker } from 'openland-server/moleculer';
import { GQLRoots } from 'openland-module-api/schema/SchemaRoots';
import TypingTypeRoot = GQLRoots.TypingTypeRoot;
import { TypingEvent } from 'openland-module-typings/TypingEvent';
import { Modules } from 'openland-modules/Modules';

const rootCtx = createNamedContext('typings');

export function registerTypingsService(xPubSub: Pubsub<TypingEvent>) {
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

                    let members = await inTx(rootCtx, async (tx) => {
                        return await Modules.Messaging.room.findConversationMembers(tx, cid);
                    });

                    let allPosts = members.map(async (v) => {
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