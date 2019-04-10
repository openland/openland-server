import { GQLResolver } from 'openland-module-api/schema/SchemaSpec';
import { withAny } from 'openland-module-api/Resolvers';
import { createHyperlogger } from './createHyperlogEvent';
import { inTx } from 'foundation-orm/inTx';

const trackEvent = createHyperlogger<{ id: string, name: string, args: any, uid?: number, tid?: string, did: string, platform: 'Android'|'iOS'|'WEB', isProd: boolean }>('track');

export default {
    Mutation: {
        track: withAny(async (ctx, args) => {
            await inTx(ctx, async (ctx2) => {
                for (let i of args.events) {
                    await trackEvent.event(ctx2, {
                        did: args.did,
                        id: i.id,
                        name: i.event,
                        args: i.params ? JSON.parse(i.params) : undefined,
                        uid: ctx.auth && ctx.auth.uid,
                        tid: ctx.auth && ctx.auth.tid,
                        platform: args.platform || 'WEB',
                        isProd: (args.isProd === undefined || args.isProd === null) ? true : args.isProd
                    });
                }
            });
            return 'ok';
        })
    }
} as GQLResolver;