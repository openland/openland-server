import { IDs } from 'openland-module-api/IDs';
import { GQLResolver } from 'openland-module-api/schema/SchemaSpec';
import { Modules } from 'openland-modules/Modules';

export const Resolver: GQLResolver = {
    UpdateEvent: {
        __resolveType: (src, ctx) => {
            if (src.type === 'updateProfileChanged') {
                if (src.uid === ctx.auth.uid) {
                    return 'UpdateMyProfileChanged';
                } else {
                    return 'UpdateProfileChanged';
                }
            } else if (src.type === 'updateChatRead') {
                return 'UpdateChatRead';
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
    }
};