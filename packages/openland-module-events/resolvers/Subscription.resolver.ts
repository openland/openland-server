import { inTx, getTransaction } from '@openland/foundationdb';
import { withUser } from 'openland-module-api/Resolvers';
import { IDs, IdsFactory } from 'openland-module-api/IDs';
import { Context } from '@openland/context';
import { GQLRoots } from 'openland-module-api/schema/SchemaRoots';
import { GQL, GQLResolver } from 'openland-module-api/schema/SchemaSpec';
import { createIterator } from 'openland-utils/asyncIterator';
import { UserError } from 'openland-errors/UserError';
import { Modules } from 'openland-modules/Modules';
import { parseSequenceId } from './Sequences.resolver';
import { AccessDeniedError } from 'openland-errors/AccessDeniedError';

function serializeVt(src: string, strict: boolean) {
    if (strict) {
        return IDs.SequenceStateStrict.serialize(src);
    } else {
        return IDs.SequenceStateFlex.serialize(src);
    }
}

function parseVt(src: string) {
    let resolved = IdsFactory.resolve(src);
    if (resolved.type === IDs.SequenceStateStrict) {
        return { strict: true, value: resolved.id as string };
    } else if (resolved.type === IDs.SequenceStateFlex) {
        return { strict: false, value: resolved.id as string };
    } else {
        throw new AccessDeniedError();
    }
}

export const Resolver: GQLResolver = {
    UpdateSubscription: {
        __resolveType: (src) => {
            if (src.type === 'started') {
                return 'UpdateSubscriptionStarted';
            } else if (src.type === 'update') {
                return 'UpdateSubscriptionEvent';
            } else if (src.type === 'update-ephemeral') {
                return 'UpdateSubscriptionEphemeralEvent';
            } else {
                throw Error('Unknown update');
            }
        }
    },
    UpdateSubscriptionStarted: {
        seq: (src) => src.seq,
        state: (src) => serializeVt(src.state, true)
    },
    UpdateSubscriptionEvent: {
        seq: (src) => src.seq,
        pts: (src) => src.pts,
        sequence: (src) => src.sequence,
        event: (src) => src.update,
        state: (src) => serializeVt(src.state, false)
    },
    UpdateSubscriptionEphemeralEvent: {
        seq: (src) => src.seq,
        sequence: (src) => src.sequence,
        event: (src) => src.update
    },
    Subscription: {
        watchUpdates: {
            resolve: (msg: GQLRoots.UpdateSubscriptionRoot) => msg,
            subscribe: async function (r: any, args: GQL.SubscriptionWatchUpdatesArgs, ctx: Context) {
                let uid = ctx.auth.uid!;
                if (!uid) {
                    throw new UserError('Not authorized');
                }

                let completed = false;
                let iterator = createIterator<GQLRoots.UpdateSubscriptionRoot>();
                let canceller = Modules.Events.mediator.receive(ctx, uid, (e) => {
                    if (e.type === 'started') {
                        iterator.push({ type: 'started', state: e.state, seq: e.seq });
                    } else if (e.type === 'update') {
                        iterator.push({ type: 'update', sequence: e.feed, seq: e.seq, pts: e.pts, state: e.state, update: e.event });
                    } else if (e.type === 'update-ephemeral') {
                        iterator.push({ type: 'update-ephemeral', sequence: e.feed, seq: e.seq, update: e.event });
                    } else {
                        // Cancel on any other event
                        if (!completed) {
                            completed = true;
                            iterator.complete();
                            canceller();
                        }
                    }
                });

                iterator.onExit = () => {
                    if (!completed) {
                        completed = true;
                        iterator.complete();
                        canceller();
                    }
                };

                return iterator;
            }
        }
    },
    UpdatesState: {
        seq: (src) => src.seq,
        state: (src) => serializeVt(src.state, true),
        sequences: (src) => src.sequences
    },
    UpdatesSequenceState: {
        pts: (src) => src.pts,
        sequence: (src) => src.sequence,
        seq: (src, _, ctx) => Modules.Events.mediator.getCurrentSeq(ctx, ctx.auth.uid!)
    },
    UpdatesDifference: {
        seq: (src) => src.seq,
        state: (src) => serializeVt(src.state, true),
        sequences: (src) => src.sequences,
        hasMore: (src) => src.hasMore
    },
    UpdatesSequenceDifference: {
        events: (src) => src.events,
        after: (src) => src.pts,
        sequence: (src) => src.sequence
    },
    UpdatesDifferenceEvent: {
        pts: (src) => src.pts,
        event: (src) => src.event,
    },
    SequenceDifference: {
        events: (src) => src.events,
        hasMore: (src) => src.hasMore,
        sequence: (src) => src.sequence,
        after: (src) => src.pts,
        seq: (src, _, ctx) => Modules.Events.mediator.getCurrentSeq(ctx, ctx.auth.uid!)
    },
    Query: {
        updatesState: withUser(async (ctx, args, uid) => {
            let init = await inTx(ctx, async (ctx2) => {
                let state = await Modules.Events.mediator.getState(ctx2, uid);
                return { state, version: getTransaction(ctx2).getCommittedVersion() };
            });
            // Keep resolver consistent with base transaction
            getTransaction(ctx).setReadVersion(await init.version);

            let feeds = await Modules.Events.mediator.getInitialFeeds(ctx, uid);
            let feedStates = await Promise.all(feeds.map(async (f) => ({ state: await Modules.Events.mediator.getFeedState(ctx, f), feed: f })));
            return {
                seq: init.state.seq,
                state: init.state.vt.resolved.value.toString('base64'),
                sequences: feedStates.map((f) => ({ sequence: f.feed, pts: f.state.pts }))
            };
        }),
        updatesDifference: withUser(async (ctx, args, uid) => {
            let state = parseVt(args.state);
            return await Modules.Events.mediator.getDifference(ctx, uid, state.value, state.strict);
        }),
        sequenceDifference: withUser(async (ctx, args, uid) => {
            let sequence = parseSequenceId(args.id, uid);
            let diff = await Modules.Events.mediator.getFeedDifference(ctx, uid, sequence, args.pts);
            return {
                hasMore: diff.hasMore,
                active: diff.active,
                events: diff.events,
                pts: diff.after,
                sequence,
            };
        }),
        sequenceState: withUser(async (ctx, args, uid) => {
            let sequence = parseSequenceId(args.id, uid);
            return { sequence: sequence, pts: await Modules.Events.mediator.getFeedSubscriberPts(ctx, sequence, uid) };
        })
    }
};