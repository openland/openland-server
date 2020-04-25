import { Modules } from 'openland-modules/Modules';
import { buildBaseImageUrl } from 'openland-module-media/ImageRef';
import { Store } from 'openland-module-db/FDB';
import { IDs, IdsFactory } from 'openland-module-api/IDs';
import { withAccount, withAny, withUser as withUserResolver } from 'openland-module-api/Resolvers';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { AppContext } from 'openland-modules/AppContext';
import { User, UserProfile, UserBadge } from 'openland-module-db/store';
import { buildMessage, MessagePart, roomMention, userMention } from '../openland-utils/MessageBuilder';
import { AccessDeniedError } from '../openland-errors/AccessDeniedError';

type UserRoot = User | UserProfile | number | UserFullRoot;

export class UserFullRoot {
    public readonly user: User;
    public readonly profile: UserProfile;

    constructor(user: User, profile: UserProfile) {
        this.user = user;
        this.profile = profile;
    }
}

export async function userRootFull(ctx: AppContext, uid: number) {
    let user = (await (Store.User.findById(ctx, uid)))!;
    let profile = (await (Store.UserProfile.findById(ctx, uid)))!;

    return new UserFullRoot(user, profile);
}

export function withUser(handler: (ctx: AppContext, user: User, authorized: Boolean) => any, noAuthNeeded: boolean = false) {
    return async (src: UserRoot, _params: {}, ctx: AppContext) => {
        let authorized = !!ctx.auth.uid;
        if (!authorized && !noAuthNeeded) {
            throw new AccessDeniedError();
        }
        if (typeof src === 'number') {
            let user = (await (Store.User.findById(ctx, src)))!;
            return handler(ctx, user, authorized);
        } else if (src instanceof UserFullRoot) {
            return handler(ctx, src.user, authorized);
        } else if (src instanceof User) {
            return handler(ctx, src, authorized);
        } else {
            let user = (await (Store.User.findById(ctx, src.id)))!;
            return handler(ctx, user, authorized);
        }
    };
}

export function withProfile(handler: (ctx: AppContext, user: User, profile: UserProfile | null, authorized: Boolean) => any, noAuthNeeded: boolean = false) {
    return async (src: UserRoot, _params: {}, ctx: AppContext) => {
        let authorized = !!ctx.auth.uid;
        if (!authorized && !noAuthNeeded) {
            throw new AccessDeniedError();
        }
        if (typeof src === 'number') {
            let user = (await (Store.User.findById(ctx, src)))!;
            if (user.status === 'deleted') {
                return handler(ctx, user, null, authorized);
            }
            let profile = (await (Store.UserProfile.findById(ctx, src)))!;
            return handler(ctx, user, profile, authorized);
        } else if (src instanceof UserFullRoot) {
            if (src.user.status === 'deleted') {
                return handler(ctx, src.user, null, authorized);
            }
            return handler(ctx, src.user, src.profile, authorized);
        } else if (src instanceof User) {
            if (src.status === 'deleted') {
                return handler(ctx, src, null, authorized);
            }
            let profile = (await (Store.UserProfile.findById(ctx, src.id)))!;
            return handler(ctx, src, profile, authorized);
        } else {
            let user = (await (Store.User.findById(ctx, src.id)))!;
            if (user.status === 'deleted') {
                return handler(ctx, user, null, authorized);
            }
            return handler(ctx, user, src, authorized);
        }

    };
}

export const Resolver: GQLResolver = {
    User: {
        id: withUser((ctx, src) => IDs.User.serialize(src.id), true),
        isBot: withUser((ctx, src) => src.isBot || false, true),
        isYou: withUser((ctx, src, authorized) => authorized ? src.id === ctx.auth.uid : false, true),
        isDeleted: withUser((ctx, src) => src.status === 'deleted', true),

        name: withProfile((ctx, src, profile) => profile ? [profile.firstName, profile.lastName].filter((v) => !!v).join(' ') : 'DELETED', true),
        firstName: withProfile((ctx, src, profile) => profile ? profile.firstName : 'DELETED', true),
        lastName: withProfile((ctx, src, profile) => profile ? profile.lastName : 'DELETED', true),
        photo: withProfile((ctx, src, profile) => profile && profile.picture ? buildBaseImageUrl(profile.picture) : null, true),
        photoRef: withProfile((ctx, src, profile) => profile && profile.picture, true),

        email: withProfile((ctx, src, profile, authorized) => authorized ? (profile ? (src.isBot ? null : profile.email) : null) : null, true),
        phone: withProfile((ctx, src, profile) => profile ? profile.phone : null),
        about: withProfile((ctx, src, profile) => profile ? profile.about : null, true),
        website: withProfile((ctx, src, profile) => profile ? profile.website : null),
        linkedin: withProfile((ctx, src, profile) => profile && profile.linkedin),
        instagram: withProfile((ctx, src, profile) => profile && profile.instagram),
        twitter: withProfile((ctx, src, profile) => profile && profile.twitter),
        facebook: withProfile((ctx, src, profile) => profile && profile.facebook),
        location: withProfile((ctx, src, profile) => profile ? profile.location : null),
        badges: withUser((ctx, src) => Store.UserBadge.user.findAll(ctx, src.id)),
        primaryBadge: withProfile((ctx, src, profile) => profile && profile.primaryBadge ? Store.UserBadge.findById(ctx, profile.primaryBadge) : null),
        audienceSize: withUser(async (ctx, src) => await Store.UserAudienceCounter.get(ctx, src.id), true),

        // Deprecated
        picture: withProfile((ctx, src, profile) => profile && profile.picture ? buildBaseImageUrl(profile.picture) : null, true),
        pictureRef: withProfile((ctx, src, profile) => profile && profile.picture, true),
        alphaRole: withProfile((ctx, src, profile) => profile && profile.role),
        alphaLinkedin: withProfile((ctx, src, profile) => profile && profile.linkedin),
        alphaTwitter: withProfile((ctx, src, profile) => profile && profile.twitter),

        channelsJoined: () => [],
        alphaLocations: withProfile((ctx, src, profile) => profile && profile.locations),
        chatsWithBadge: withProfile(async (ctx, src, profile) => {
            let res: { cid: number, badge: UserBadge }[] = [];

            let badges = await Store.UserRoomBadge.user.findAll(ctx, src.id);
            for (let badge of badges) {
                let chat = await Store.ConversationRoom.findById(ctx, badge.cid);
                if (!chat) {
                    continue;
                }
                if (chat.kind !== 'public') {
                    continue;
                }
                if (!chat.oid) {
                    continue;
                }
                let org = await Store.Organization.findById(ctx, chat.oid);
                if (!org || org.kind !== 'community' || org.private) {
                    continue;
                }
                if (!await Modules.Messaging.room.isRoomMember(ctx, src.id, badge.cid)) {
                    continue;
                }

                res.push({cid: badge.cid, badge: (await Store.UserBadge.findById(ctx, badge.bid!))!});
            }
            return res;
        })
    },
    UserChatWithBadge: {
        badge: src => src.badge,
        chat: src => src.cid
    },
    Query: {
        me: async function (_obj: any, _params: {}, ctx: AppContext) {
            if (!ctx.auth.uid) {
                return null;
            } else {
                return await userRootFull(ctx, ctx.auth.uid);
            }
        },
        user: withAny(async (ctx, args) => {
            let shortname = await Modules.Shortnames.findShortname(ctx, args.id);
            let user: User | null;

            if (shortname && shortname.enabled && shortname.ownerType === 'user') {
                user = await Store.User.findById(ctx, shortname.ownerId);
            } else {
                user = await Store.User.findById(ctx, IDs.User.parse(args.id));
            }
            // if (user && user.status === 'deleted') {
            //     throw new NotFoundError();
            // }
            return user!;
        }),
        mySuccessfulInvitesCount: withUserResolver(async (ctx, args, uid) => {
            return Store.UserSuccessfulInvitesCounter.get(ctx, uid);
        })
    },
    Mutation: {
        reportContent: withAccount(async (ctx, args, uid) => {
            let message: MessagePart[] = [`🚨‼🚨 Report: \n`, 'Type: ' + args.type + '\n'];
            if (args.message) {
                message.push(`Message: ${args.message}\n`);
            }
            message.push(`From: `, userMention(await Modules.Users.getUserFullName(ctx, uid), uid), '\n');

            let id = IdsFactory.resolve(args.contentId);

            if (id.type === IDs.User) {
                message.push('user: ', userMention(await Modules.Users.getUserFullName(ctx, id.id as number), id.id as number));
            } else if (id.type === IDs.Organization) {
                message.push('org: openland.com/' + args.contentId);
            } else if (id.type === IDs.Conversation) {
                message.push('room: ', roomMention(await Modules.Messaging.room.resolveConversationTitle(ctx, id.id as number, uid), id.id as number));
            } else if (id.type === IDs.FeedItem) {
                message.push('post: openland.com/feed/' + args.contentId);
            }

            let superBotId = await Modules.Super.getEnvVar<number>(ctx, 'super-notifications-app-id');
            let reportChatId = await Modules.Super.getEnvVar<number>(ctx, 'content-report-chat-id');

            if (superBotId && reportChatId) {
                await Modules.Messaging.sendMessage(ctx, reportChatId, superBotId, buildMessage(...message));
            }
            return true;
        }),
        deleteMyAccount: withAccount(async (ctx, args, uid) => {
            await Modules.Users.deleteUser(ctx, uid);
            return true;
        }),
    }
};
