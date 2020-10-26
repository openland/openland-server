import { inTx, getTransaction } from '@openland/foundationdb';
import { withUser } from 'openland-module-api/Resolvers';
import { IDs } from 'openland-module-api/IDs';
import { Context } from '@openland/context';
import { GQLRoots } from 'openland-module-api/schema/SchemaRoots';
import { GQL, GQLResolver } from 'openland-module-api/schema/SchemaSpec';
import { createIterator } from 'openland-utils/asyncIterator';
import { UserError } from 'openland-errors/UserError';
import { Modules } from 'openland-modules/Modules';

export const Resolver: GQLResolver = {
    UpdateSubscription: {
        __resolveType: (src) => {
            if (src.type === 'started') {
                return 'UpdateSubscriptionStarted';
            } else if (src.type === 'checkpoint') {
                return 'UpdateSubscriptionCheckpoint';
            } else if (src.type === 'update') {
                return 'UpdateSubscriptionEvent';
            } else {
                throw Error('Unknown update');
            }
        }
    },
    UpdateSubscriptionStarted: {
        seq: (src) => src.seq,
        state: (src) => IDs.SequenceStateV1.serialize(src.state)
    },
    UpdateSubscriptionCheckpoint: {
        seq: (src) => src.seq,
        state: (src) => IDs.SequenceStateV1.serialize(src.state)
    },
    UpdateSubscriptionEvent: {
        seq: (src) => src.seq,
        pts: (src) => src.pts,
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
                        iterator.push({ type: 'update', sequence: e.feed, seq: e.seq, pts: e.pts, update: e.event });
                    } else if (e.type === 'checkpoint') {
                        iterator.push({ type: 'checkpoint', state: e.state, seq: e.seq });
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
        state: (src) => IDs.SequenceStateV1.serialize(src.state),
        sequences: (src) => src.sequences
    },
    UpdatesSequenceState: {
        pts: (src) => src.pts,
        sequence: (src) => src.sequence
    },
    UpdatesDifference: {
        seq: (src) => src.seq,
        state: (src) => IDs.SequenceStateV1.serialize(src.state),
        sequences: (src) => src.sequences,
        hasMore: (src) => src.hasMore
    },
    UpdatesSequenceDifference: {
        pts: (src) => src.pts,
        events: (src) => src.events,
        sequence: (src) => src.sequence
    },
    UpdatesDifferenceEvent: {
        pts: (src) => src.pts,
        event: (src) => src.event,
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
            let res = await inTx(ctx, async (ctx2) => {
                let diff = await Modules.Events.mediator.getDifference(ctx2, uid, IDs.SequenceStateV1.parse(args.state));
                return { diff, version: getTransaction(ctx2).getCommittedVersion() };
            });
            // Keep resolver consistent with base transaction
            getTransaction(ctx).setReadVersion(await res.version);

            // Resolving sequences
            return {
                seq: res.diff.seq,
                state: res.diff.state,
                hasMore: res.diff.hasMore,
                sequences: res.diff.sequences
            };
        })
    }
};