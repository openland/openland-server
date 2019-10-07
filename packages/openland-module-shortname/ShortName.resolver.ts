import { withAccount } from '../openland-module-api/Resolvers';
import { UserError } from '../openland-errors/UserError';
import { ErrorText } from '../openland-errors/ErrorText';
import { Modules } from 'openland-modules/Modules';
import { Store } from 'openland-module-db/FDB';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { IDs, IdsFactory } from '../openland-module-api/IDs';
import { withUser } from '../openland-module-users/User.resolver';
import { User, Organization } from 'openland-module-db/store';
import { AccessDeniedError } from '../openland-errors/AccessDeniedError';

export default {
    ShortNameDestination: {
        __resolveType(src: any) {
            if (src instanceof User) {
                return 'User';
            } else if (src instanceof Organization) {
                return 'Organization';
            }

            throw new Error('Unknown shortname type');
        }
    },

    Query: {
        alphaResolveShortName: withAccount(async (ctx, args, uid, orgId) => {
            let ownerId;
            let ownerType;
            try {
                let idInfo = IdsFactory.resolve(args.shortname);
                if (idInfo.type.typeId === IDs.User.typeId) {
                    ownerType = 'user';
                } else if (idInfo.type.typeId === IDs.Organization.typeId) {
                    ownerType = 'org';
                }
            } catch {
                let shortname = await Modules.Shortnames.findShortname(ctx, args.shortname);
                if (shortname) {
                    ownerId =  shortname.ownerId;
                    ownerType = shortname.ownerType;
                }
            }

            if (!ownerId || !ownerType) {
                return null;
            }

            if (ownerType === 'user') {
                return await Store.User.findById(ctx, ownerId);
            } else if (ownerType === 'org') {
                return await Store.Organization.findById(ctx, ownerId);
            } else if (ownerType === 'feed_channel') {
                return await Store.FeedChannel.findById(ctx, ownerId);
            }

            return null;
        }),
    },
    Mutation: {
        alphaSetUserShortName: withAccount(async (ctx, args, uid, orgId) => {
            await Modules.Shortnames.setShortName(ctx, args.shortname, 'user', uid, uid);
            return 'ok';
        }),
        alphaSetOrgShortName: withAccount(async (ctx, args, uid) => {
            let orgId = IDs.Organization.parse(args.id);

            let member = await Store.OrganizationMember.findById(ctx, orgId, uid);
            if (member === null || member.status !== 'joined' || member.role !== 'admin') {
                throw new UserError(ErrorText.permissionOnlyOwner);
            }

            await Modules.Shortnames.setShortName(ctx, args.shortname, 'org', orgId, uid);
            return 'ok';
        }),
        alphaSetFeedChannelShortName: withAccount(async (ctx, args, uid) => {
            let channelId = IDs.FeedChannel.parse(args.id);
            let role = await Modules.Feed.roleInChannel(ctx, channelId, uid);
            if (role !== 'creator') {
                throw new AccessDeniedError();
            }
            await Modules.Shortnames.setShortName(ctx, args.shortname, 'feed_channel', channelId, uid);
            return 'ok';
        }),
    },

    User: {
        shortname: withUser(async (ctx, src) => {
            let shortName = await Modules.Shortnames.findShortnameByOwner(ctx, 'user', src.id);
            return shortName ? shortName.shortname : null;
        }),
    },
    Profile: {
        shortname: withUser(async (ctx, src) => {
            let shortName = await Modules.Shortnames.findShortnameByOwner(ctx, 'user', src.id);
            return shortName ? shortName.shortname : null;
        }),
    },
    Organization: {
        shortname: async (src, args, ctx) => {
            let shortName = await Modules.Shortnames.findShortnameByOwner(ctx, 'org', src.id);
            return shortName ? shortName.shortname : null;
        },
    },
    OrganizationProfile: {
        shortname: async (src, args, ctx) => {
            let shortName = await Modules.Shortnames.findShortnameByOwner(ctx, 'org', src.id);
            return shortName ? shortName.shortname : null;
        },
    },
    FeedChannel: {
        shortname: async (src, args, ctx) => {
            let shortName = await Modules.Shortnames.findShortnameByOwner(ctx, 'feed_channel', src.id);
            return shortName ? shortName.shortname : null;
        },
    }
} as GQLResolver;