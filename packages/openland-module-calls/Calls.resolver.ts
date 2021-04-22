import { Capabilities } from './repositories/CallScheduler';
import { ConferenceRoom, ConferencePeer, Conversation } from './../openland-module-db/store';
import { inTx, withoutTransaction } from '@openland/foundationdb';
import { withUser } from 'openland-module-api/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { IDs } from 'openland-module-api/IDs';
import { Context } from '@openland/context';
import { Store } from 'openland-module-db/FDB';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { resolveTurnServices } from './services/TURNService';
import { buildMessage, userMention } from '../openland-utils/MessageBuilder';
import { GQLRoots } from 'openland-module-api/schema/SchemaRoots';
import { fastWatch } from 'openland-module-db/fastWatch';
import { NotFoundError } from '../openland-errors/NotFoundError';
import { UserError } from '../openland-errors/UserError';

// @ts-ignore
// const resolveNearestTurn = async (latLong: { lat: number, long: number }) => {
//     let turns = await resolveTurnServices();
//     let nearestDist = Number.MAX_SAFE_INTEGER;
//     let nearest: any;
//     for (let turn of turns) {
//         let turnPosition = await geoIP(turn.ip);
//         if (!turnPosition.coordinates) {
//             continue;
//         }
//         let dist = await distanceBetween(turnPosition.coordinates, latLong);
//         if (dist < nearestDist) {
//             nearestDist = dist;
//             nearest = turn;
//         }
//     }
//     if (!nearest) {
//         return turns;
//     }
//     return [nearest];
// };

const resolveIce = async (root: any, args: any, context: Context) => {
    // if (context.req.latLong) {
    //     return await resolveNearestTurn(context.req.latLong);
    // }
    return await resolveTurnServices(context);
};

const resolveMeshStreamLink = async (src: { id: string, pid: number }, ctx: Context) => {
    let peer = await Store.ConferencePeer.findById(ctx, src.pid);
    if (!peer) {
        return null;
    }
    let meshPeer = await Store.ConferenceMeshPeer.findById(ctx, peer.cid, peer.id);
    if (!meshPeer) {
        return null;
    }
    return (await Store.ConferenceMeshLink.conference.findAll(ctx, peer.cid))
        .find((v) => v.esid1 === src.id || v.esid2 === src.id);
};

export const Resolver: GQLResolver = {
    ConferenceParent: {
        __resolveType(obj: Conversation) {
            if (obj.kind === 'voice') {
                return 'VoiceChat';
            } else if (obj.kind === 'room') {
                return 'SharedRoom';
            } else if (obj.kind === 'private') {
                return 'PrivateRoom';
            } else {
                throw new Error('Unsupported conversation type');
            }
        }
    },
    Conference: {
        id: (src: ConferenceRoom) => IDs.Conference.serialize(src.id),
        startTime: (src: ConferenceRoom) => src.startTime,
        peers: async (src: ConferenceRoom, args: {}, ctx: Context) => {
            let res = (await Modules.Calls.repo.findActiveMembers(ctx, src.id));
            res.sort((a, b) => a.metadata.createdAt - b.metadata.createdAt);
            return res;
        },
        room: async (src: ConferenceRoom, args: {}, ctx: Context) => {
            let chat = await Store.Conversation.findById(ctx, src.id);
            if (chat?.kind === 'room' || chat?.kind === 'private') {
                return chat;
            }
            return null;
        },
        parent: async (src: ConferenceRoom, args: {}, ctx: Context) => {
            return await Store.Conversation.findById(ctx, src.id);
        },

        // Deprecated
        iceServers: resolveIce,
        // Deprecated
        strategy: (src) => 'MASH' /* TODO: Fix Me */,
        // Deprecated
        kind: (src) => src.kind === 'conference' ? 'CONFERENCE' : 'STREAM',
    },
    ConferencePeer: {
        id: (src: ConferencePeer) => IDs.ConferencePeer.serialize(src.id),
        user: (src: ConferencePeer) => src.uid,
        mediaState: async (src, args, ctx) => {
            let conf = await Store.ConferenceRoom.findById(ctx, src.cid);
            return {
                screencastEnabled: src.id === conf?.screenSharingPeerId,
                videoPaused: !!src.videoPaused,
                audioPaused: !!src.audioPaused,
            };
        },
        keepAlive: async (src, _, ctx) => (await Modules.Calls.repo.getPeerKeepAlive(ctx, src.cid, src.id)) || 0
    },

    //
    // Media
    //

    ConferenceMedia: {
        id: (src) => IDs.ConferenceMedia.serialize(src.id),
        iceServers: resolveIce,
        streams: async (src, args: {}, ctx: Context) => {
            return await Modules.Calls.repo.endStreamDirectory.getPeerStreams(ctx, src.peerId);
        },
        localMedia: async (src, args: {}, ctx: Context) => {
            let conf = await Store.ConferenceRoom.findById(ctx, src.id);
            let peer = await Store.ConferencePeer.findById(ctx, src.peerId);
            return ({
                sendVideo: !!peer!.videoPaused,
                sendAudio: !!peer!.audioPaused,
                sendScreencast: conf!.screenSharingPeerId === src.peerId
            });
        },
    },
    IceTransportPolicy: {
        ALL: 'all',
        RELAY: 'relay',
        NONE: 'none'
    },
    MediaStreamState: {
        NEED_OFFER: 'need-offer',
        WAIT_OFFER: 'wait-offer',
        WAIT_ANSWER: 'wait-answer',
        NEED_ANSWER: 'need-answer',
        READY: 'online'
    },
    MediaSender: {
        kind: (src) => src.kind,
        codecParams: (src) => src.codecParams ? src.codecParams : null,
        videoSource: (src) => src.videoSource ? src.videoSource : null,
    },
    MediaReceiver: {
        peerId: (src) => IDs.ConferencePeer.serialize(src.pid),
        kind: (src) => src.kind,
        videoSource: (src) => src.videoSource ? src.videoSource : null
    },
    MediaKind: {
        AUDIO: 'audio',
        VIDEO: 'video'
    },
    VideoSource: {
        SCREEN: 'screen',
        CAMERA: 'default'
    },
    MediaStream: {
        id: (src) => IDs.MediaStream.serialize(src),
        state: async (src, _, ctx) => (await Modules.Calls.repo.endStreamDirectory.getState(ctx, src))!,
        seq: async (src, _, ctx) => (await Modules.Calls.repo.endStreamDirectory.getSeq(ctx, src))!,
        sdp: async (src, _, ctx) => (await Modules.Calls.repo.endStreamDirectory.getRemoteSdp(ctx, src))!,
        ice: async (src, _, ctx) => (await Modules.Calls.repo.endStreamDirectory.getRemoteCandidates(ctx, src))!,
        iceTransportPolicy: async (src, _, ctx) => (await Modules.Calls.repo.endStreamDirectory.getIceTransportPolicy(ctx, src))!,
        senders: async (src, _, ctx) => {
            let localStreams = (await Modules.Calls.repo.endStreamDirectory.getLocalStreams(ctx, src))!;
            return localStreams.map((v) => ({
                kind: v.type,
                codecParams: (v.type === 'video' || v.type === 'audio') ? v.codec : undefined,
                videoSource: v.type === 'video' ? v.source : undefined,
                mid: v.mid
            }));
        },
        receivers: async (src, _, ctx) => {
            let remoteStreams = (await Modules.Calls.repo.endStreamDirectory.getRemoteStreams(ctx, src))!;
            return remoteStreams.map((v) => ({
                pid: v.pid,
                kind: v.media.type,
                videoSource: v.media.type === 'video' ? v.media.source : undefined,
                mid: v.media.mid
            }));
        },

        // Deprecated
        peerId: async (src, args, ctx) => {
            // peer state is bound to stream in old clients
            let pid = (await Modules.Calls.repo.endStreamDirectory.getPid(ctx, src))!;
            let link = await resolveMeshStreamLink({ id: src, pid }, ctx);
            if (!link) {
                return null;
            }
            return IDs.ConferencePeer.serialize(pid === link.pid1 ? link.pid2 : link.pid1);
        },
        // Deprecated
        settings: async (src, arg, ctx) => {
            let localStreams = (await Modules.Calls.repo.endStreamDirectory.getLocalStreams(ctx, src))!;

            let localVideo = localStreams.find(s => s.type === 'video');
            return {
                audioOut: !!localStreams.find(s => s.type === 'audio'),
                audioIn: true,
                videoIn: true,
                videoOut: !!localVideo,
                videoOutSource: (localVideo && localVideo.type === 'video' && localVideo.source === 'screen') ? 'screen_share' : 'camera' as 'screen_share' | 'camera'
            };
        },
        // Deprecated
        mediaState: async (src, args, ctx) => {
            let [pid, remoteStreams] = await Promise.all([
                Modules.Calls.repo.endStreamDirectory.getPid(ctx, src),
                Modules.Calls.repo.endStreamDirectory.getRemoteStreams(ctx, src),
            ]);
            let res = {
                videoPaused: false,
                audioPaused: false,
                videoSource: 'camera' as 'camera' | 'screen_share',
                audioOut: true,
                videoOut: false
            };
            let link = await resolveMeshStreamLink({ id: src, pid: pid! }, ctx);
            if (!link) {
                return res;
            }
            let otherPeerId = pid === link.pid1 ? link.pid2 : link.pid1;
            let otherPeer = await Store.ConferencePeer.findById(ctx, otherPeerId);
            if (!otherPeer) {
                return res;
            }
            res.audioPaused = !!otherPeer.audioPaused;
            res.videoPaused = !!otherPeer.videoPaused;
            let remoteVideo = remoteStreams?.find(s => s.media.type === 'video');
            res.videoSource = remoteVideo?.media.type === 'video' && remoteVideo.media.source === 'screen' ? 'screen_share' : 'camera';
            return res;
        },
        // Deprecated
        localStreams: async (src, _, ctx) => {
            return (await Modules.Calls.repo.endStreamDirectory.getLocalStreams(ctx, src))!;
        }
    },
    // Deprecated
    LocalStreamConfig: {
        __resolveType(obj: GQLRoots.LocalStreamConfigRoot) {
            if (obj.type === 'audio') {
                return 'LocalStreamAudioConfig';
            } else if (obj.type === 'video') {
                return 'LocalStreamVideoConfig';
            } else if (obj.type === 'dataChannel') {
                return 'LocalStreamDataChannelConfig';
            } else {
                throw new Error('Unknow stream config' + obj);
            }
        }
    },
    // Deprecated
    LocalStreamAudioConfig: {
        codec: src => src.codec
    },
    // Deprecated
    LocalStreamVideoConfig: {
        codec: src => src.codec
    },
    // Deprecated
    LocalStreamDataChannelConfig: {
        id: src => src.id,
        label: src => src.label,
        ordered: src => src.ordered
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
        conferenceJoin: withUser(async (parent, args, uid) => {
            return await inTx(withoutTransaction(parent), async (ctx) => {
                let cid = IDs.Conference.parse(args.id);
                let capabilities: Capabilities | null = null;
                if (args.input && args.input.capabilities) {
                    capabilities = args.input.capabilities;
                }

                let conv = await Store.Conversation.findById(ctx, cid);
                if (!conv) {
                    throw new NotFoundError();
                }

                // Not allowing join the conference is its private chat
                // cid is room so lets fetch the room
                let privateConv = await Store.ConversationPrivate.findById(ctx, cid);
                if (privateConv) { // this conversation is private
                    if (await Modules.BlackListModule.isUserBanned(ctx, privateConv.uid1, privateConv.uid2)) {
                        throw Error('User is banned, could not start a call');
                    }
                    if (await Modules.BlackListModule.isUserBanned(ctx, privateConv.uid2, privateConv.uid1)) {
                        throw Error('User is banned, could not start a call');
                    }
                }

                let role: 'speaker' | 'listener' = 'speaker';

                // Determine role for voice chats
                if (conv.kind === 'voice') {
                    let voiceChatMember = await Store.VoiceChatParticipant.findById(ctx, conv.id, uid);
                    if (!voiceChatMember || voiceChatMember.status !== 'joined') {
                        throw new UserError(`User is not member of voice chat`);
                    }
                    if (voiceChatMember.role === 'speaker' || voiceChatMember.role === 'admin') {
                        role = 'speaker';
                    } else if (voiceChatMember.role === 'listener') {
                        role = 'listener';
                    }
                }

                let res = await Modules.Calls.repo.addPeer(ctx, {
                    cid,
                    uid,
                    tid: ctx.auth.tid!,
                    timeout: 60000,
                    kind: args.kind === 'STREAM' ? 'stream' : 'conference',
                    capabilities,
                    media: args.input?.media,
                    ip: ctx.req.ip || 'unknown',
                    role
                });
                let activeMembers = await Modules.Calls.repo.findActiveMembers(ctx, cid);
                if (activeMembers.length === 1 && conv.kind !== 'voice') {
                    let fullName = await Modules.Users.getUserFullName(ctx, uid);
                    await Modules.Messaging.sendMessage(ctx, cid, uid, {
                        ...buildMessage(userMention(fullName, uid), ' started a\u00A0call'),
                        isService: true
                    });
                }
                return {
                    peerId: IDs.ConferencePeer.serialize(res.id),
                    conference: await Modules.Calls.repo.getOrCreateConference(ctx, cid)
                };
            });
        }),
        conferenceKeepAlive: withUser(async (parent, args, uid) => {
            return await inTx(withoutTransaction(parent), async (ctx) => {
                let coid = IDs.Conference.parse(args.id);
                let pid = IDs.ConferencePeer.parse(args.peerId);
                let peer = (await Store.ConferencePeer.findById(ctx, pid))!;
                if (peer.uid !== uid) {
                    throw Error('Invalid user id');
                }
                await Modules.Calls.repo.peerKeepAlive(ctx, coid, pid, 60000);
                return Modules.Calls.repo.getOrCreateConference(ctx, coid);
            });
        }),
        conferenceLeave: withUser(async (parent, args, uid) => {
            return await inTx(withoutTransaction(parent), async (ctx) => {
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
            });
        }),

        mediaStreamOffer: withUser(async (parent, args, uid) => {
            return await inTx(withoutTransaction(parent), async (ctx) => {
                // Resolve
                let id = IDs.MediaStream.parse(args.id);
                let pid = IDs.ConferencePeer.parse(args.peerId);
                let peer = (await Store.ConferencePeer.findById(ctx, pid))!;
                if (peer.uid !== uid) {
                    throw Error('Invalid user id');
                }

                // Update
                await Modules.Calls.repo.streamOffer(ctx, id, pid, args.offer, args.seq, args.hints ? args.hints.map((v) => ({
                    peerId: v.peerId ? IDs.ConferencePeer.parse(v.peerId) : null,
                    kind: v.kind,
                    direction: v.direction,
                    mid: v.mid,
                    videoSource: v.videoSource
                })) : null);

                // Result
                return { id: peer.cid, peerId: peer.id };
            });
        }),

        mediaStreamAnswer: withUser(async (parent, args, uid) => {
            return await inTx(withoutTransaction(parent), async (ctx) => {
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
            });
        }),
        mediaStreamCandidate: withUser(async (parent, args, uid) => {
            return await inTx(withoutTransaction(parent), async (ctx) => {
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
            });
        }),
        mediaStreamFailed: withUser(async (parent, args, uid) => {
            return await inTx(withoutTransaction(parent), async (ctx) => {
                let pid = IDs.ConferencePeer.parse(args.peerId);
                let peer = (await Store.ConferencePeer.findById(ctx, pid))!;
                await Modules.Calls.repo.streamFailed(ctx, args.id, peer.id);
                return { id: peer.cid, peerId: peer.id };
            });
        }),

        // Deprecated
        mediaStreamNegotiationNeeded: withUser(async (parent, args, uid) => {
            return await inTx(withoutTransaction(parent), async (ctx) => {
                let pid = IDs.ConferencePeer.parse(args.peerId);
                let peer = (await Store.ConferencePeer.findById(ctx, pid))!;
                // elder client mb turned video on
                // remove after 1.1.3048 ios / 1.1.2512 android will gain adoption
                if (peer.videoPaused === null) {
                    await Modules.Calls.repo.alterConferencePeerMediaState(ctx, peer.cid, uid, parent.auth.tid!, null, false);
                }
                return { id: peer.cid, peerId: peer.id };
            });
        }),
        // Deprecated
        conferenceAddScreenShare: withUser(async (parent, args, uid) => {
            return await inTx(withoutTransaction(parent), async (ctx) => {
                let cid = IDs.Conference.parse(args.id);
                return await Modules.Calls.repo.addScreenShare(ctx, cid, uid, ctx.auth.tid!);
            });
        }),
        // Deprecated
        conferenceRemoveScreenShare: withUser(async (parent, args, uid) => {
            return await inTx(withoutTransaction(parent), async (ctx) => {
                let cid = IDs.Conference.parse(args.id);
                let peer = await Store.ConferencePeer.auth.find(ctx, cid, uid, ctx.auth.tid!);
                if (!peer) {
                    throw Error('Unable to find peer');
                }
                return await Modules.Calls.repo.removeScreenShare(ctx, peer);
            });
        }),
        // Deprecated
        conferenceAlterMediaState: withUser(async (parent, args, uid) => {
            return await inTx(withoutTransaction(parent), async (ctx) => {
                let cid = IDs.Conference.parse(args.id);
                return await Modules.Calls.repo.alterConferencePeerMediaState(ctx, cid, uid, ctx.auth.tid!, args.state.audioPaused, args.state.videoPaused);
            });
        }),

        conferenceRequestLocalMediaChange: withUser(async (parent, args, uid) => {
            return await inTx(withoutTransaction(parent), async (ctx) => {
                let cid = IDs.Conference.parse(args.id);
                return await Modules.Calls.repo.conferenceRequestLocalMediaChange(ctx, cid, uid, ctx.auth.tid!, args.media);
            });
        }),

        // Deprecated
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
    },
    Subscription: {
        alphaConferenceWatch: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async function* (_: any, args: { id: string }, parent: Context) {
                let cid = IDs.Conference.parse(args.id);

                const initial = await inTx(parent, async (ctx) => {
                    let initVersion = await Modules.Calls.repo.getConferenceVersion(ctx, cid);
                    let value = (await Store.ConferenceRoom.findById(ctx, cid))!;
                    return { initVersion, value };
                });
                let version = initial.initVersion;
                yield initial.value;

                while (true) {
                    let changed = await fastWatch(parent, 'conference-' + cid, version,
                        async (ctx) => (await inTx(ctx, async (ctx2) => Modules.Calls.repo.getConferenceVersion(ctx2, cid)))
                    );
                    if (changed.result) {
                        version = changed.version;
                        yield await inTx(parent, async (ctx) => (await Store.ConferenceRoom.findById(ctx, cid))!);
                    } else {
                        break;
                    }
                }
            }
        },
        alphaConferenceMediaWatch: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async function* (_: any, args: { id: string, peerId: string }, parent: Context) {
                let cid = IDs.Conference.parse(args.id);
                let pid = IDs.ConferencePeer.parse(args.peerId);

                let version = await inTx(parent, async (ctx) => Modules.Calls.repo.getPeerVersion(ctx, pid));
                yield { id: cid, peerId: pid };

                while (true) {
                    let changed = await fastWatch(parent, 'conference-peer-' + pid, version,
                        (ctx) => inTx(ctx, async (ctx2) => Modules.Calls.repo.getPeerVersion(ctx2, pid))
                    );
                    if (changed.result) {
                        version = changed.version;
                        yield { id: cid, peerId: pid };
                    } else {
                        break;
                    }
                }
                // let ended = false;
                // return {
                //     ...(async function* func() {
                //         while (!ended) {
                //             // let settings = await FDB.ConferenceRoom.findById(ctx, cid);
                //             yield { id: cid, peerId: pid };
                //             let w = await inTx(ctx, async (ctx2) => Store.ConferenceRoom.watch(ctx2, cid));
                //             await w.promise;
                //         }
                //     })(),
                //     return: async () => {
                //         ended = true;
                //         return 'ok';
                //     }
                // };
            }
        }
    }
};
