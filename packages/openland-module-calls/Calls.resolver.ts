import { ConferenceRoom, ConferencePeer } from './../openland-module-db/store';
import { inTx } from '@openland/foundationdb';
import { withUser, withPermission } from 'openland-module-api/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { IDs } from 'openland-module-api/IDs';
import { Context } from '@openland/context';
import { AppContext } from 'openland-modules/AppContext';
import { Store } from 'openland-module-db/FDB';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { resolveTurnServices } from './services/TURNService';
import { buildMessage, userMention } from '../openland-utils/MessageBuilder';

export const Resolver: GQLResolver = {
    ConferenceStrategy: {
        MASH: 'mash',
        SFU: 'sfu'
    },
    ConferenceKind: {
        CONFERENCE: 'conference',
        STREAM: 'stream'
    },
    Conference: {
        id: (src: ConferenceRoom) => IDs.Conference.serialize(src.id),
        startTime: (src: ConferenceRoom) => src.startTime,
        peers: async (src: ConferenceRoom, args: {}, ctx: Context) => {
            let res = (await Modules.Calls.repo.findActiveMembers(ctx, src.id));
            res.sort((a, b) => a.metadata.createdAt - b.metadata.createdAt);
            return res;
        },
        iceServers: () => {
            return resolveTurnServices();
        },
        strategy: (src) => src.strategy,
        kind: (src) => src.kind,
    },
    ConferencePeer: {
        id: (src: ConferencePeer) => IDs.ConferencePeer.serialize(src.id),
        user: (src: ConferencePeer) => src.uid,
        connection: async (src: ConferencePeer, args: {}, ctx: AppContext) => {
            let outgoing = await Store.ConferencePeer.auth.find(ctx, src.cid, ctx.auth.uid!, ctx.auth.tid!);
            if (outgoing) {
                let connection = await Store.ConferenceConnection.findById(ctx, Math.min(src.id, outgoing!.id), Math.max(src.id, outgoing!.id));
                if (!connection) {
                    return null;
                }
                if (connection.state === 'completed') {
                    return null;
                }

                let state: 'READY' | 'WAIT_OFFER' | 'NEED_OFFER' | 'WAIT_ANSWER' | 'NEED_ANSWER' = 'READY';
                let sdp: string | null = null;
                let isPrimary = src.id > outgoing.id;
                let ice: string[] = isPrimary ? connection.ice2 : connection.ice1;
                if (connection.state === 'wait-offer') {
                    if (isPrimary) {
                        state = 'NEED_OFFER';
                    } else {
                        state = 'WAIT_OFFER';
                    }
                } else if (connection.state === 'wait-answer') {
                    if (isPrimary) {
                        state = 'WAIT_ANSWER';
                    } else {
                        state = 'NEED_ANSWER';
                        sdp = connection.offer;
                    }
                } else if (connection.state === 'online') {
                    if (isPrimary) {
                        sdp = connection.answer;
                    } else {
                        sdp = connection.offer;
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
    ConferenceMedia: {
        id: (src) => IDs.ConferenceMedia.serialize(src.id),
        iceServers: resolveTurnServices,
        streams: async (src, args: {}, ctx: AppContext) => {
            // let outgoing = await FDB.ConferencePeer.findFromAuth(ctx, src.id, ctx.auth.uid!, ctx.auth.tid!);

            let connections = await Store.ConferenceMediaStream.conference.findAll(ctx, src.id);
            let res = [];
            for (let c of connections) {
                if (c.peer1 === src.peerId || c.peer2 === src.peerId) {
                    let id = c.id;
                    let state: 'READY' | 'WAIT_OFFER' | 'NEED_OFFER' | 'WAIT_ANSWER' | 'NEED_ANSWER' = 'READY';
                    let seq = c.seq || 0;
                    let sdp: string | null = null;
                    let isPrimary = src.peerId === c.peer1;
                    let ice: string[] = isPrimary ? c.ice2 : c.ice1;
                    if (c.state === 'wait-offer') {
                        if (isPrimary) {
                            state = 'NEED_OFFER';
                        } else {
                            state = 'WAIT_OFFER';
                        }
                    } else if (c.state === 'wait-answer') {
                        if (isPrimary) {
                            state = 'WAIT_ANSWER';
                        } else {
                            state = 'NEED_ANSWER';
                            sdp = c.offer;
                        }
                    } else if (c.state === 'online') {
                        if (isPrimary) {
                            sdp = c.answer;
                        } else {
                            sdp = c.offer;
                        }
                    } else {
                        throw Error('Unkown state: ' + c.state);
                    }
                    res.push({
                        id: IDs.MediaStream.serialize(id),
                        peerId: src.peerId === c.peer1 ? (c.peer2 !== null ? IDs.ConferencePeer.serialize(c.peer2) : null) : IDs.ConferencePeer.serialize(c.peer1),
                        state,
                        seq,
                        sdp,
                        ice,
                        settings: src.peerId === c.peer1 ? c.settings1! : c.settings2!,
                    });
                }
            }
            return res;
        },

    },
    Query: {
        conference: withUser(async (ctx, args, uid) => {
            return Modules.Calls.repo.getOrCreateConference(ctx, IDs.Conversation.parse(args.id));
        }),
        conferenceMedia: withUser(async (ctx, args, uid) => {
            return {
                id: IDs.Conference.parse(args.id),
                peerId: IDs.ConferencePeer.parse(args.peerId)
            };
        })
    },
    Mutation: {
        conferenceJoin: withUser(async (ctx, args, uid) => {
            let cid = IDs.Conference.parse(args.id);
            let res = await Modules.Calls.repo.addPeer(ctx, cid, uid, ctx.auth.tid!, 15000, args.kind || 'conference');
            let activeMembers = await Modules.Calls.repo.findActiveMembers(ctx, cid);
            if (activeMembers.length === 1) {
                let fullName = await Modules.Users.getUserFullName(ctx, uid);
                await Modules.Messaging.sendMessage(ctx, cid, uid, {
                    ...buildMessage(userMention(fullName, uid), ' has started a call'),
                    isService: true
                });
            }
            return {
                peerId: IDs.ConferencePeer.serialize(res.id),
                conference: await Modules.Calls.repo.getOrCreateConference(ctx, cid)
            };
        }),
        conferenceLeave: withUser(async (ctx, args, uid) => {
            let coid = IDs.Conference.parse(args.id);
            let pid = IDs.ConferencePeer.parse(args.peerId);

            let chat = await Store.Conversation.findById(ctx, coid);
            await Modules.Calls.repo.removePeer(ctx, pid);
            if (chat && chat.kind === 'private') {
                await Modules.Calls.repo.endConference(ctx, coid);
            } else {
                await Modules.Calls.repo.removePeer(ctx, pid);
            }

            return Modules.Calls.repo.getOrCreateConference(ctx, coid);
        }),
        conferenceKeepAlive: withUser(async (ctx, args, uid) => {
            let coid = IDs.Conference.parse(args.id);
            let pid = IDs.ConferencePeer.parse(args.peerId);
            await Modules.Calls.repo.peerKeepAlive(ctx, coid, pid, 15000);
            return Modules.Calls.repo.getOrCreateConference(ctx, coid);
        }),

        mediaStreamOffer: withUser(async (ctx, args, uid) => {
            let mid = IDs.MediaStream.parse(args.id);
            let pid = IDs.ConferencePeer.parse(args.peerId);
            await Modules.Calls.repo.streamOffer(ctx, mid, pid, args.offer, args.seq === null ? undefined : args.seq);
            let cid = (await Store.ConferenceMediaStream.findById(ctx, mid))!.cid;
            return { id: cid, peerId: pid };
        }),

        mediaStreamNegotiationNeeded: withUser(async (ctx, args, uid) => {
            let mid = IDs.MediaStream.parse(args.id);
            let pid = IDs.ConferencePeer.parse(args.peerId);
            await Modules.Calls.repo.streamNegotiationNeeded(ctx, mid, pid, args.seq === null ? undefined : args.seq);
            let cid = (await Store.ConferenceMediaStream.findById(ctx, mid))!.cid;
            return { id: cid, peerId: pid };
        }),

        mediaStreamFailed: withUser(async (ctx, args, uid) => {
            let mid = IDs.MediaStream.parse(args.id);
            let pid = IDs.ConferencePeer.parse(args.peerId);
            await Modules.Calls.repo.streamFailed(ctx, mid, pid);
            let cid = (await Store.ConferenceMediaStream.findById(ctx, mid))!.cid;
            return { id: cid, peerId: pid };
        }),

        mediaStreamAnswer: withUser(async (ctx, args, uid) => {
            let mid = IDs.MediaStream.parse(args.id);
            let pid = IDs.ConferencePeer.parse(args.peerId);
            await Modules.Calls.repo.streamAnswer(ctx, mid, pid, args.answer, args.seq === null ? undefined : args.seq);
            let cid = (await Store.ConferenceMediaStream.findById(ctx, mid))!.cid;
            return { id: cid, peerId: pid };
        }),

        mediaStreamCandidate: withUser(async (ctx, args, uid) => {
            let mid = IDs.MediaStream.parse(args.id);
            let pid = IDs.ConferencePeer.parse(args.peerId);
            await Modules.Calls.repo.streamCandidate(ctx, mid, pid, args.candidate);
            let cid = (await Store.ConferenceMediaStream.findById(ctx, mid))!.cid;
            return { id: cid, peerId: pid };
        }),

        peerConnectionOffer: withUser(async (ctx, args, uid) => {
            let coid = IDs.Conference.parse(args.id);
            let srcPid = IDs.ConferencePeer.parse(args.ownPeerId);
            let dstPid = IDs.ConferencePeer.parse(args.peerId);
            await Modules.Calls.repo.connectionOffer(ctx, coid, srcPid, dstPid, args.offer);
            return Modules.Calls.repo.getOrCreateConference(ctx, coid);
        }),
        peerConnectionAnswer: withUser(async (ctx, args, uid) => {
            let coid = IDs.Conference.parse(args.id);
            let srcPid = IDs.ConferencePeer.parse(args.ownPeerId);
            let dstPid = IDs.ConferencePeer.parse(args.peerId);
            await Modules.Calls.repo.connectionAnswer(ctx, coid, srcPid, dstPid, args.answer);
            return Modules.Calls.repo.getOrCreateConference(ctx, coid);
        }),
        peerConnectionCandidate: withUser(async (ctx, args, uid) => {
            let coid = IDs.Conference.parse(args.id);
            let srcPid = IDs.ConferencePeer.parse(args.ownPeerId);
            let dstPid = IDs.ConferencePeer.parse(args.peerId);
            await Modules.Calls.repo.connectionCandidate(ctx, coid, srcPid, dstPid, args.candidate);
            return Modules.Calls.repo.getOrCreateConference(ctx, coid);
        }),
        conferenceAlterSettings: withPermission('super-admin', async (ctx, args) => {
            let coid = IDs.Conversation.parse(args.id);
            let conf = await Modules.Calls.repo.getOrCreateConference(ctx, coid);
            if (args.settings.iceTransportPolicy) {
                conf.iceTransportPolicy = args.settings.iceTransportPolicy;
            }
            if (args.settings.strategy) {
                conf.strategy = args.settings.strategy;
            }
            return conf;
        }),
    },
    Subscription: {
        alphaConferenceWatch: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async function (_: any, args: { id: string }, parent: AppContext) {
                let cid = IDs.Conference.parse(args.id);
                let ended = false;
                return {
                    ...(async function* func() {
                        while (!ended) {
                            let r = await inTx(parent, async (ctx) => {
                                let settings = await Store.ConferenceRoom.findById(ctx, cid);
                                let watch = Store.ConferenceRoom.watch(ctx, cid);
                                return { settings, watch };
                            });
                            yield r.settings!;
                            await r.watch.promise!;
                        }
                    })(),
                    return: async () => {
                        ended = true;
                        return 'ok';
                    }
                };
            }
        },
        alphaConferenceMediaWatch: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async function (_: any, args: { id: string, peerId: string }, ctx: AppContext) {
                let cid = IDs.Conference.parse(args.id);
                let pid = IDs.ConferencePeer.parse(args.peerId);
                let ended = false;
                return {
                    ...(async function* func() {
                        while (!ended) {
                            // let settings = await FDB.ConferenceRoom.findById(ctx, cid);
                            yield { id: cid, peerId: pid };
                            let w = await inTx(ctx, async (ctx2) => Store.ConferenceRoom.watch(ctx2, cid));
                            await w.promise;
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
};
