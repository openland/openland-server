import { Store } from 'openland-module-db/FDB';
import { IDs } from 'openland-module-api/IDs';
import { GQLResolver } from 'openland-module-api/schema/SchemaSpec';
import { Modules } from 'openland-modules/Modules';

export const Resolver: GQLResolver = {
    UpdateEvent: {
        __resolveType: async (src, ctx) => {
            if (src.type === 'updateProfileChanged') {
                if (src.uid === ctx.auth.uid) {
                    return 'UpdateMyProfileChanged';
                } else {
                    return 'UpdateProfileChanged';
                }
            } else if (src.type === 'updateChatRead') {
                return 'UpdateChatRead';
            } else if (src.type === 'updateChatMessage' || src.type === 'updateChatMessageUpdated') {
                let msg = (await Store.Message.findById(ctx, src.mid))!;
                if (!msg || msg.deleted || (msg.hiddenForUids !== null && !!msg.hiddenForUids.find((v) => v === ctx.auth.uid))) {
                    return 'UpdateChatMessageDeleted';
                } else {
                    return 'UpdateProfileChanged';
                }
            } else if (src.type === 'updateChatMessageDeleted') {
                return 'UpdateChatMessageDeleted';
            }
            throw Error('Unknown update');
        },
    },
    UpdateMyProfileChanged: {
        user: (src) => src.uid,
        profile: async (src, { }, ctx) => (await Modules.Users.profileById(ctx, ctx.auth.uid!))!
    },
    UpdateProfileChanged: {
        user: (src) => src.uid,
    },
    UpdateChatRead: {
        cid: (src) => IDs.Conversation.serialize(src.cid),
        seq: (src) => src.seq
    },
    UpdateChatMessage: {
        cid: (src) => IDs.Conversation.serialize(src.cid),
        message: async (src, { }, ctx) => (await Store.Message.findById(ctx, src.mid))!
    },
    UpdateChatMessageDeleted: {
        cid: (src) => IDs.Conversation.serialize(src.cid),
        mid: (src) => IDs.Message.serialize(src.mid),
        seq: async (src, { }, ctx) => (await Store.Message.findById(ctx, src.mid))!.seq!
    }
};