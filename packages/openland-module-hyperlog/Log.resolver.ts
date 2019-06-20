import { inTx } from '@openland/foundationdb';
import { GQLResolver } from 'openland-module-api/schema/SchemaSpec';
import { withAny } from 'openland-module-api/Resolvers';
import { createHyperlogger } from './createHyperlogEvent';
import { Context } from '@openland/context';
import { uuid } from '../openland-utils/uuid';
import { InternalTrackEvent } from './workers/declareBatchAmplitudeIndexer';

export interface InternalTrackEvent {
    id: string;
    name: string;
    args?: any;
    uid?: number;
    tid?: string;
    did: string;
    platform: 'Android' | 'iOS' | 'WEB';
    isProd: boolean;
    time: number;
}

export const trackEvent = createHyperlogger<InternalTrackEvent>('track');

const isProd = process.env.APP_ENVIRONMENT === 'production';

export async function trackServerEvent(ctx: Context, event: { name: string, uid?: number, args?: any }) {
    await trackEvent.event(ctx, {
        id: uuid(),
        platform: 'WEB',
        did: 'server',
        time: Date.now(),
        isProd,
        ...event
    });
}

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
                        isProd: (args.isProd === undefined || args.isProd === null) ? true : args.isProd,
                        time: i.time ? i.time.getTime() : Date.now()
                    });
                }
            });
            return 'ok';
        })
    }
} as GQLResolver;