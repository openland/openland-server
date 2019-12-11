import { inTx } from '@openland/foundationdb';
import { GQLResolver } from 'openland-module-api/schema/SchemaSpec';
import { withAny } from 'openland-module-api/Resolvers';
import { createHyperlogger } from './createHyperlogEvent';
import { Context } from '@openland/context';
import { uuid } from '../openland-utils/uuid';
import { UserError } from '../openland-errors/UserError';
import { createLogger } from '@openland/log';

export interface InternalTrackEvent {
    id: string;
    name: string;
    args?: any;
    uid?: number;
    tid?: string;
    did: string;
    platform: 'Android' | 'iOS' | 'WEB' | 'MobileWeb';
    deviceModel?: string;
    os?: string;
    isProd: boolean;
    time: number;
}

export const trackEvent = createHyperlogger<InternalTrackEvent>('track');

const log = createLogger('track');
const isProd = process.env.APP_ENVIRONMENT === 'production';

export function trackServerEvent(ctx: Context, event: { name: string, uid?: number, args?: any }) {
    trackEvent.event(ctx, {
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
                    if (i.params) {
                        let parsed = JSON.parse(i.params);
                        if (typeof parsed !== 'object' || Array.isArray(parsed)) {
                            throw new UserError('params should be map');
                        }
                        if (Object.keys(parsed).length === 0) {
                            i.params = null;
                        }
                        for (let key of Object.keys(parsed)) {
                            let val = parsed[key];
                            if (typeof val === 'object' && Object.keys(val).length === 0) {
                                log.log(ctx2, 'invalid event', i);
                                i.params = null;
                                // throw new UserError('params can\'t contain empty maps');
                            }
                        }
                    }
                    if (i.event.trim().length === 0) {
                        throw new UserError('Event should be string');
                    }
                    trackEvent.event(ctx2, {
                        did: args.did,
                        id: i.id,
                        name: i.event,
                        args: i.params ? JSON.parse(i.params) : undefined,
                        uid: ctx.auth && ctx.auth.uid,
                        tid: ctx.auth && ctx.auth.tid,
                        deviceModel: i.deviceModel || undefined,
                        os: i.os || undefined,
                        platform: i.platform ? i.platform : (args.platform || 'WEB'),
                        isProd: (args.isProd === undefined || args.isProd === null) ? true : args.isProd,
                        time: i.time ? i.time.getTime() : Date.now()
                    });
                }
            });
            return 'ok';
        })
    }
} as GQLResolver;