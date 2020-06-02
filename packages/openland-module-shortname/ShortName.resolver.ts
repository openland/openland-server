import { withAccount, withPermission } from '../openland-module-api/Resolvers';
import { UserError } from '../openland-errors/UserError';
import { ErrorText } from '../openland-errors/ErrorText';
import { Modules } from 'openland-modules/Modules';
import { Store } from 'openland-module-db/FDB';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { IDs, IdsFactory } from '../openland-module-api/IDs';
import { withUser } from '../openland-module-users/User.resolver';
import {
    User,
    Organization,
    FeedChannel,
    ConversationRoom, EditorsChoiceChatsCollection, DiscussionHub,
} from 'openland-module-db/store';
import { AccessDeniedError } from '../openland-errors/AccessDeniedError';

export const Resolver: GQLResolver = {
    ShortNameDestination: {
        __resolveType(src: any) {
            if (src instanceof User) {
                return 'User';
            } else if (src instanceof Organization) {
                return 'Organization';
            } else if (src instanceof FeedChannel) {
                return 'FeedChannel';
            } else if (src instanceof ConversationRoom) {
                return 'SharedRoom';
            } else if (src instanceof EditorsChoiceChatsCollection) {
                return 'DiscoverChatsCollection';
            } else if (src instanceof DiscussionHub) {
                return 'Channel';
            }

            throw new Error('Unknown shortname type');
        }
    },

    Query: {
        alphaResolveShortName: async (src, args, ctx) => {
            let ownerId;
            let ownerType: 'user' | 'org' | 'feed_channel' | 'room' | 'collection' | 'hub' | undefined;
            try {
                let idInfo = IdsFactory.resolve(args.shortname);
                if (idInfo.type === IDs.User) {
                    ownerType = 'user';
                } else if (idInfo.type === IDs.Organization) {
                    ownerType = 'org';
                } else if (idInfo.type === IDs.FeedChannel) {
                    ownerType = 'feed_channel';
                } else if (idInfo.type === IDs.Conversation) {
                    ownerType = 'room';
                } else if (idInfo.type === IDs.DiscoverChatsCollection) {
                    ownerType = 'collection';
                } else if (idInfo.type === IDs.Hub) {
                    ownerType = 'hub';
                }
                ownerId = idInfo.id as number;
            } catch {
                let shortname = await Modules.Shortnames.findShortname(ctx, args.shortname);
                if (shortname) {
                    ownerId = shortname.ownerId;
                    ownerType = shortname.ownerType;
                }
            }

            if (!ownerId || !ownerType) {
                return null;
            }

            let authorized = !!ctx.auth.uid;

            if (ownerType === 'user') {
                return await Store.User.findById(ctx, ownerId);
            } else if (ownerType === 'org' && authorized) {
                return await Store.Organization.findById(ctx, ownerId);
            } else if (ownerType === 'feed_channel' && authorized) {
                return await Store.FeedChannel.findById(ctx, ownerId);
            } else if (ownerType === 'room') {
                let room = await Store.ConversationRoom.findById(ctx, ownerId);
                if (!room) {
                    return null;
                }
                if (authorized && (await Modules.Messaging.room.canUserSeeChat(ctx, ctx.auth.uid!, room.id))) {
                    return room;
                }
                if (!authorized) {
                    if (room.kind !== 'public') {
                        return null;
                    }
                    if (room.oid) {
                        let org = (await Store.Organization.findById(ctx, room.oid))!;
                        if (org.kind === 'community' && org.private) {
                            return null;
                        }
                    }
                }
                return room;
            } else if (ownerType === 'collection') {
                return await Store.EditorsChoiceChatsCollection.findById(ctx, ownerId);
            } else if (ownerType === 'hub') {
                return (await Store.DiscussionHub.findById(ctx, ownerId));
            }

            return null;
        },
    },
    Mutation: {
        alphaSetUserShortName: withAccount(async (ctx, args, uid, orgId) => {
            let userId = uid;
            if (args.id && (await Modules.Super.superRole(ctx, uid)) === 'super-admin') {
                userId = IDs.User.parse(args.id);
            }
            await Modules.Shortnames.setShortName(ctx, args.shortname, 'user', userId, uid);
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
        alphaSetRoomShortName: withAccount(async (ctx, args, uid) => {
            let cid = IDs.Conversation.parse(args.id);
            let room = await Store.ConversationRoom.findById(ctx, cid);
            if (!room || room.kind !== 'public') {
                throw new UserError(`Shortname can be set only for public rooms`);
            }
            let isAdmin = await Modules.Messaging.room.userHaveAdminPermissionsInRoom(ctx, uid, cid);
            if (!isAdmin) {
                throw new AccessDeniedError();
            }
            await Modules.Shortnames.setShortName(ctx, args.shortname, 'room', cid, uid);
            return 'ok';
        }),
        alphaSetCollectionShortName: withPermission('super-admin', async (ctx, args) => {
            let cid = IDs.DiscoverChatsCollection.parse(args.id);
            await Modules.Shortnames.setShortName(ctx, args.shortname, 'collection', cid, ctx.auth.uid!);
            return 'ok';
        })
    },

    User: {
        shortname: withUser(async (ctx, src) => {
            let shortName = await Modules.Shortnames.findShortnameByOwner(ctx, 'user', src.id);
            return shortName ? shortName.shortname : null;
        }, true),
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
    },
    SharedRoom: {
        shortname: async (src, args, ctx) => {
            let shortName = await Modules.Shortnames.findShortnameByOwner(ctx, 'room', typeof src === 'number' ? src : src.id);
            return shortName ? shortName.shortname : null;
        },
    },
    DiscoverChatsCollection: {
        shortname: async (src, args, ctx) => {
            let shortName = await Modules.Shortnames.findShortnameByOwner(ctx, 'collection', src.id);
            return shortName ? shortName.shortname : null;
        },
    },
    Channel: {
        shortname: async (src, args, ctx) => {
            return (await Modules.Shortnames.findShortnameByOwner(ctx, 'hub', src.id))!.shortname;
        },
    }
};
