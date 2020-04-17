import { ConferenceRoom, ConferencePeer } from './../openland-module-db/store';
import { inTx } from '@openland/foundationdb';
import { withUser } from 'openland-module-api/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { IDs } from 'openland-module-api/IDs';
import { Context } from '@openland/context';
import { AppContext } from 'openland-modules/AppContext';
import { Store } from 'openland-module-db/FDB';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { resolveTurnServices } from './services/TURNService';
import { buildMessage, userMention } from '../openland-utils/MessageBuilder';
import { distanceBetweenIP } from '../openland-utils/geoIp/geoIP';

const resolveNearestTurn = async (ip: string) => {
    let turns = await resolveTurnServices();
    let nearestDist = Number.MAX_SAFE_INTEGER;
    let nearest: any;
    for (let turn of turns) {
        let dist = await distanceBetweenIP(turn.ip, ip);
        if (dist < nearestDist) {
            nearestDist = dist;
            nearest = turn;
        }
    }
    return nearest;
};

const resolveIce = async (root: any, args: any, context: AppContext) => {
    if (context.req.ip) {
        return [await resolveNearestTurn(context.req.ip)];
    }
    return await resolveTurnServices();
};

export const Resolver: GQLResolver = {
    Conference: {
        id: (src: ConferenceRoom) => IDs.Conference.serialize(src.id),
        startTime: (src: ConferenceRoom) => src.startTime,
        peers: async (src: ConferenceRoom, args: {}, ctx: Context) => {
            let res = (await Modules.Calls.repo.findActiveMembers(ctx, src.id));
            res.sort((a, b) => a.metadata.createdAt - b.metadata.createdAt);
            return res;
        },
        iceServers: resolveIce,
        strategy: (src) => 'MASH' /* TODO: Fix Me */,
        kind: (src) => src.kind === 'conference' ? 'CONFERENCE' : 'STREAM',
    },
    ConferencePeer: {
        id: (src: ConferencePeer) => IDs.ConferencePeer.serialize(src.id),
        user: (src: ConferencePeer) => src.uid
    },
    ConferenceMedia: {
        id: (src) => IDs.ConferenceMedia.serialize(src.id),
        iceServers: resolveIce,
        streams: async (src, args: {}, ctx: AppContext) => {
            return await Store.ConferenceEndStream.peer.findAll(ctx, src.peerId);
        },
    },
    MediaStream: {
        id: (src) => IDs.MediaStream.serialize(src.id),
        state: (src) => {
            if (src.state === 'wait-offer') {
                return 'WAIT_OFFER';
            } else if (src.state === 'need-offer') {
                return 'NEED_OFFER';
            } else if (src.state === 'wait-answer') {
                return 'WAIT_ANSWER';
            } else if (src.state === 'need-answer') {
                return 'NEED_ANSWER';
            } else if (src.state === 'online') {
                return 'READY';
            } else {
                throw Error('Unknown state');
            }
        },
        seq: (src) => src.seq,
        sdp: (src) => src.remoteSdp,
        ice: (src) => src.remoteCandidates,
        peerId: (src) => null,
        settings: (src) => {
            return {
                audioOut: true,
                audioIn: true,
                videoIn: false,
                videoOut: false,
                videoOutSource: 'camera'
            };
        },
        mediaState: (src) => {
            return {
                videoPaused: false,
                audioPaused: false,
                videoSource: 'camera',
                audioOut: true,
                videoOut: false
            };
        }
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
            let res = await Modules.Calls.repo.addPeer(ctx, cid, uid, ctx.auth.tid!, 15000, args.kind === 'STREAM' ? 'stream' : 'conference');
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
        conferenceAddScreenShare: withUser(async (ctx, args, uid) => {
            let cid = IDs.Conference.parse(args.id);
            return await Modules.Calls.repo.addScreenShare(ctx, cid, uid, ctx.auth.tid!);
        }),
        conferenceRemoveScreenShare: withUser(async (ctx, args, uid) => {
            let cid = IDs.Conference.parse(args.id);
            let peer = await Store.ConferencePeer.auth.find(ctx, cid, uid, ctx.auth.tid!);
            if (!peer) {
                throw Error('Unable to find peer');
            }
            return await Modules.Calls.repo.removeScreenShare(ctx, peer);
        }),
        conferenceAlterMediaState: withUser(async (ctx, args, uid) => {
            let cid = IDs.Conference.parse(args.id);
            return await Modules.Calls.repo.alterConferencePeerMediaState(ctx, cid, uid, ctx.auth.tid!, args.state.audioPaused, args.state.videoPaused);
        }),

        conferenceLeave: withUser(async (ctx, args, uid) => {
            let coid = IDs.Conference.parse(args.id);
            let pid = IDs.ConferencePeer.parse(args.peerId);
            let peer = (await Store.ConferencePeer.findById(ctx, pid))!;
            if (peer.uid !== uid) {
                throw Error('Invalid user id');
            }

            let chat = await Store.Conversation.findById(ctx, coid);
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
            let peer = (await Store.ConferencePeer.findById(ctx, pid))!;
            if (peer.uid !== uid) {
                throw Error('Invalid user id');
            }
            await Modules.Calls.repo.peerKeepAlive(ctx, coid, pid, 15000);
            return Modules.Calls.repo.getOrCreateConference(ctx, coid);
        }),
        conferenceAlterSettings: withUser(async (parent, args) => {
            return await inTx(parent, async (ctx) => {
                let coid = IDs.Conversation.parse(args.id);
                let conf = await Modules.Calls.repo.getOrCreateConference(ctx, coid);
                if (args.settings.strategy) {
                    if (args.settings.strategy === 'MASH' && args.settings.iceTransportPolicy) {
                        if (args.settings.iceTransportPolicy === 'all') {
                            conf.scheduler = 'mesh-no-relay';
                        } else {
                            conf.scheduler = 'mesh';
                        }
                    } else if (args.settings.strategy === 'SFU') {
                        conf.scheduler = 'basic-sfu';
                    }
                }
                return conf;
            });
        }),

        mediaStreamOffer: withUser(async (ctx, args, uid) => {

            // Resolve
            let id = IDs.MediaStream.parse(args.id);
            let pid = IDs.ConferencePeer.parse(args.peerId);
            let peer = (await Store.ConferencePeer.findById(ctx, pid))!;
            if (peer.uid !== uid) {
                throw Error('Invalid user id');
            }

            // Update
            await Modules.Calls.repo.streamOffer(ctx, id, pid, args.offer, args.seq === null ? undefined : args.seq);

            // Result
            return { id: peer.cid, peerId: peer.id };
        }),

        mediaStreamAnswer: withUser(async (ctx, args, uid) => {

            // Resolve
            let id = IDs.MediaStream.parse(args.id);
            let pid = IDs.ConferencePeer.parse(args.peerId);
            let peer = (await Store.ConferencePeer.findById(ctx, pid))!;
            if (peer.uid !== uid) {
                throw Error('Invalid user id');
            }

            // Update
            await Modules.Calls.repo.streamAnswer(ctx, id, pid, args.answer, args.seq === null ? undefined : args.seq);

            // Result
            return { id: peer.cid, peerId: peer.id };
        }),

        mediaStreamCandidate: withUser(async (ctx, args, uid) => {

            // Resolve
            let id = IDs.MediaStream.parse(args.id);
            let pid = IDs.ConferencePeer.parse(args.peerId);
            let peer = (await Store.ConferencePeer.findById(ctx, pid))!;
            if (peer.uid !== uid) {
                throw Error('Invalid user id');
            }

            // Update
            await Modules.Calls.repo.streamCandidate(ctx, id, pid, args.candidate);

            // Result
            return { id: peer.cid, peerId: peer.id };
        }),

        mediaStreamNegotiationNeeded: withUser(async (ctx, args, uid) => {
            let pid = IDs.ConferencePeer.parse(args.peerId);
            let peer = (await Store.ConferencePeer.findById(ctx, pid))!;
            return { id: peer.cid, peerId: peer.id };
        }),

        mediaStreamFailed: withUser(async (ctx, args, uid) => {
            let pid = IDs.ConferencePeer.parse(args.peerId);
            let peer = (await Store.ConferencePeer.findById(ctx, pid))!;
            return { id: peer.cid, peerId: peer.id };
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
