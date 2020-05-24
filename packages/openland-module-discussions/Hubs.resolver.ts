import { IDs } from 'openland-module-api/IDs';
import { Modules } from 'openland-modules/Modules';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { withPermission } from 'openland-module-api/Resolvers';
import { Store } from 'openland-module-db/FDB';

export const Resolver: GQLResolver = {
    Hub: {
        id: (src) => IDs.Hub.serialize(src.id),
        title: async (src, _, ctx) => src.description.type === 'personal' ? Modules.Users.getUserFullName(ctx, src.description.uid) + ' personal hub' : src.description.title,
        type: (src) => src.description.type,
        owner: (src) => (src.description.type === 'personal' || src.description.type === 'secret') ? src.description.uid : null
    },
    HubType: {
        SYSTEM: 'system',
        PUBLIC: 'public',
        SECRET: 'secret',
        PERSONAL: 'personal'
    },
    Query: {
        hub: async (_, args, ctx) => {
            return await Store.DiscussionHub.findById(ctx, IDs.Hub.parse(args.id));
        },
        hubs: async (_, args, ctx) => {
            return await Store.DiscussionHub.findAll(ctx);
        }
    },
    Mutation: {
        hubCreate: withPermission('super-admin', (ctx, args) => {
            return Modules.Discussions.hubs.createSystemHub(args.input.title!, ctx);
        })
    }
};