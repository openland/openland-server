import { withUser } from 'openland-module-api/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { IDs } from 'openland-module-api/IDs';
import { ConferenceRoom, ConferenceParticipant } from 'openland-module-db/schema';
import { Context } from 'openland-utils/Context';
import { AppContext } from 'openland-modules/AppContext';
import { FDB } from 'openland-module-db/FDB';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';

export default {
    Conference: {
        id: (src: ConferenceRoom) => IDs.Conference.serialize(src.id),
        participants: (src: ConferenceRoom, args: {}, ctx: Context) => Modules.Calls.repo.findActiveMembers(ctx, src.id)
    },
    ConferenceParticipant: {
        id: (src: ConferenceParticipant) => IDs.ConferenceParticipant.serialize(src.id),
        user: (src: ConferenceParticipant) => src.uid,
    },
    Query: {
        conference: withUser(async (ctx, args, uid) => {
            return Modules.Calls.repo.findConference(ctx, IDs.Conversation.parse(args.id));
        })
    },
    Mutation: {
        conferenceJoin: withUser(async (ctx, args, uid) => {
            await Modules.Calls.repo.conferenceJoin(ctx, IDs.Conversation.parse(args.id), uid, ctx.auth.tid!, 15000);
            return Modules.Calls.repo.findConference(ctx, IDs.Conversation.parse(args.id));
        }),
        conferenceLeave: withUser(async (ctx, args, uid) => {
            await Modules.Calls.repo.conferenceLeave(ctx, IDs.Conversation.parse(args.id), uid, ctx.auth.tid!);
            return Modules.Calls.repo.findConference(ctx, IDs.Conversation.parse(args.id));
        }),
        conferenceKeepAlive: withUser<{ id: string }, any>(async (ctx, args, uid) => {
            await Modules.Calls.repo.conferenceJoin(ctx, IDs.Conversation.parse(args.id), uid, ctx.auth.tid!, 15000);
            return Modules.Calls.repo.findConference(ctx, IDs.Conversation.parse(args.id));
        })
    },
    Subscription: {
        alphaConferenceWatch: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async function (_: any, args: { id: string }, ctx: AppContext) {
                let cid = IDs.Conversation.parse(args.id);
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