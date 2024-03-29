import { IDs } from 'openland-module-api/IDs';
import { Modules } from 'openland-modules/Modules';
import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { withPermission, withUser } from 'openland-module-api/Resolvers';
import { Store } from 'openland-module-db/FDB';

export const Resolver: GQLResolver = {
    Channel: {
        id: (src) => IDs.Hub.serialize(src.id),
        title: async (src, _, ctx) => src.description.type === 'personal' ? Modules.Users.getUserFullName(ctx, src.description.uid) + ' personal hub' : src.description.title,
        type: (src) => src.description.type,
        owner: (src) => (src.description.type === 'personal' || src.description.type === 'secret') ? src.description.uid : null
    },
    ChannelType: {
        SYSTEM: 'system',
        PUBLIC: 'public',
        SECRET: 'secret',
        PERSONAL: 'personal'
    },
    Query: {
        channel: async (_, args, ctx) => {
            return await Store.DiscussionHub.findById(ctx, IDs.Hub.parse(args.id));
        },
        channels: async (_, args, ctx) => {
            return await Store.DiscussionHub.findAll(ctx);
        }
    },
    Mutation: {
        channelCreate: withPermission('super-admin', (ctx, args) => {
            return Modules.Discussions.hubs.createSystemHub(ctx, ctx.auth.uid!, args.input.title!, args.input.shortname!);
        }),
        channelCreatePublic: withUser(async (ctx, args, uid) => {
            return Modules.Discussions.hubs.createPublicHub(ctx, uid, args.input.title!, args.input.shortname!);
        })
    }
};