import { withUser } from 'openland-module-api/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { IDs } from 'openland-module-api/IDs';
import { ConferenceRoom, ConferencePeer } from 'openland-module-db/schema';
import { Context } from 'openland-utils/Context';
import { AppContext } from 'openland-modules/AppContext';
import { FDB } from 'openland-module-db/FDB';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';

export default {
    Conference: {
        id: (src: ConferenceRoom) => IDs.Conference.serialize(src.id),
        peers: (src: ConferenceRoom, args: {}, ctx: Context) => Modules.Calls.repo.findActiveMembers(ctx, src.id)
    },
    ConferencePeer: {
        id: (src: ConferencePeer) => IDs.ConferencePeer.serialize(src.id),
        user: (src: ConferencePeer) => src.uid,
        connection: async (src: ConferencePeer, args: {}, ctx: AppContext) => {
            let outgoing = await FDB.ConferencePeer.findFromAuth(ctx, src.cid, ctx.auth.uid!, ctx.auth.tid!);
            if (outgoing) {
                let connection = await FDB.ConferenceConnection.findById(ctx, Math.min(src.id, outgoing!.id), Math.max(src.id, outgoing!.id));
                if (!connection) {
                    return null;
                }
                if (connection.state === 'completed') {
                    return null;
                }

                let state: 'READY' | 'WAIT_OFFER' | 'NEED_OFFER' | 'WAIT_ANSWER' | 'NEED_ANSWER' = 'READY';
                let sdp: string | null = null;
                let isPrimary = src.id < outgoing.id;
                let ice: string[] = isPrimary ? connection.ice1 : connection.ice2;
                if (connection.state === 'wait-offer') {
                    if (isPrimary) {
                        state = 'WAIT_OFFER';
                    } else {
                        state = 'NEED_OFFER';
                    }
                } else if (connection.state === 'wait-answer') {
                    if (isPrimary) {
                        state = 'NEED_ANSWER';
                        sdp = connection.offer;
                    } else {
                        state = 'WAIT_ANSWER';
                    }
                } else if (connection.state === 'online') {
                    if (isPrimary) {
                        sdp = connection.offer;
                    } else {
                        sdp = connection.answer;
                    }
                } else {
                    throw Error('Unkown state: ' + connection.state);
                }
                return {
                    state,
                    sdp,
                    ice
                };
            } else {
                return null;
            }
        }
    },
    Query: {
        conference: withUser(async (ctx, args, uid) => {
            return Modules.Calls.repo.findConference(ctx, IDs.Conversation.parse(args.id));
        })
    },
    Mutation: {
        conferenceJoin: withUser(async (ctx, args, uid) => {
            let cid = IDs.Conference.parse(args.id);
            let res = await Modules.Calls.repo.conferenceJoin(ctx, cid, uid, ctx.auth.tid!, 15000);
            return {
                peerId: IDs.ConferencePeer.serialize(res.id),
                conference: Modules.Calls.repo.findConference(ctx, cid)
            };
        }),
        conferenceLeave: withUser(async (ctx, args, uid) => {
            let coid = IDs.Conference.parse(args.id);
            let pid = IDs.ConferencePeer.parse(args.peerId);
            await Modules.Calls.repo.conferenceLeave(ctx, coid, pid);
            return Modules.Calls.repo.findConference(ctx, coid);
        }),
        conferenceKeepAlive: withUser(async (ctx, args, uid) => {
            let coid = IDs.Conference.parse(args.id);
            let pid = IDs.ConferencePeer.parse(args.peerId);
            await Modules.Calls.repo.conferenceKeepAlive(ctx, coid, pid, 15000);
            return Modules.Calls.repo.findConference(ctx, coid);
        }),
        peerConnectionOffer: withUser(async (ctx, args, uid) => {
            let coid = IDs.Conference.parse(args.id);
            let srcPid = IDs.ConferencePeer.parse(args.ownPeerId);
            let dstPid = IDs.ConferencePeer.parse(args.peerId);
            await Modules.Calls.repo.connectionOffer(ctx, coid, srcPid, dstPid, args.offer);
            return Modules.Calls.repo.findConference(ctx, coid);
        }),
        peerConnectionAnswer: withUser(async (ctx, args, uid) => {
            let coid = IDs.Conference.parse(args.id);
            let srcPid = IDs.ConferencePeer.parse(args.ownPeerId);
            let dstPid = IDs.ConferencePeer.parse(args.peerId);
            await Modules.Calls.repo.connectionAnswer(ctx, coid, srcPid, dstPid, args.answer);
            return Modules.Calls.repo.findConference(ctx, coid);
        }),
        peerConnectionCandidate: withUser(async (ctx, args, uid) => {
            let coid = IDs.Conference.parse(args.id);
            let srcPid = IDs.ConferencePeer.parse(args.ownPeerId);
            let dstPid = IDs.ConferencePeer.parse(args.peerId);
            await Modules.Calls.repo.peerConnectionCandidate(ctx, coid, srcPid, dstPid, args.candidate);
            return Modules.Calls.repo.findConference(ctx, coid);
        })
    },
    Subscription: {
        alphaConferenceWatch: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async function (_: any, args: { id: string }, ctx: AppContext) {
                let cid = IDs.Conference.parse(args.id);
                let ended = false;
                return {
                    ...(async function* func() {
                        while (!ended) {
                            let settings = await FDB.ConferenceRoom.findById(ctx, cid);
                            yield settings;
                            await new Promise((resolve) => FDB.ConferenceRoom.watch(ctx, cid, () => {
                                resolve();
                            }));
                        }
                    })(),
                    return: async () => {
                        ended = true;
                        return 'ok';
                    }
                };
            }
        }
    }
} as GQLResolver;