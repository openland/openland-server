import { inTx } from '@openland/foundationdb';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { Modules } from '../openland-modules/Modules';
import { withAccount, withPermission } from '../openland-module-api/Resolvers';
import { IDs } from '../openland-module-api/IDs';
import { AccessDeniedError } from '../openland-errors/AccessDeniedError';
import { stringNotEmpty, validate } from '../openland-utils/NewInputValidator';
import { Sanitizer } from '../openland-utils/Sanitizer';
import { withProfile } from '../openland-module-users/User.resolver';
import { Store } from 'openland-module-db/FDB';

export const Resolver: GQLResolver = {
    AppToken: {
        salt: src => src.salt
    },

    AppProfile: {
        id: src => IDs.User.serialize(src.id),
        name: withProfile((ctx, src, profile) => profile!.firstName),
        shortname: async (src, args, ctx) => {
            let shortname = await Modules.Shortnames.findShortnameByOwner(ctx, 'user', src.id);
            return shortname && shortname.shortname;
        },
        photoRef: withProfile((ctx, src, profile) => profile && profile.picture),
        about: withProfile((ctx, src, profile) => profile && profile.about),
        token: async (src, args, ctx) => await Modules.Bots.getAppToken(ctx, ctx.auth!.uid!, src.id)
    },

    AppChat: {
        chat: hook => hook.chatId,
        webhook: hook => {
            let domain = '';
            if (process.env.APP_ENVIRONMENT === 'production') {
                domain = 'https://api.openland.com';
            } else {
                domain = 'http://localhost:9000';
            }

            return `${domain}/apps/chat-hook/${hook.key}`;
        }
    },

    AppStorageValue: {
        id: (src) => IDs.UserStorageRecord.serialize(src.id),
        key: (src) => src.key,
        value: (src) => src.value
    },

    Query: {
        myApps: withAccount(async (ctx, args, uid, orgId) => {
            return await Modules.Bots.findAppsCreatedByUser(ctx, uid);
        }),
        userStorage: withAccount(async (ctx, args, uid, orgId) => {
            return await Modules.Bots.fetchKeys(ctx, uid, args.namespace, args.keys);
        })
    },

    Mutation: {
        createApp: withAccount(async (ctx, args, uid) => {
            return await Modules.Bots.createApp(ctx, uid, args.name, { about: args.about || undefined, shortname: args.shortname || undefined, photo: Sanitizer.sanitizeImageRef(args.photoRef) || undefined, isSuperBot: false });
        }),
        createSuperApp: withPermission('super-admin', async (ctx, args) => {
            return await Modules.Bots.createApp(ctx, ctx.auth.uid!, args.name, { about: args.about || undefined, shortname: args.shortname || undefined, photo: Sanitizer.sanitizeImageRef(args.photoRef) || undefined, isSuperBot: true });
        }),
        refreshAppToken: withAccount(async (ctx, args, uid, orgId) => {
            let botId = IDs.User.parse(args.appId);

            await Modules.Bots.refreshAppToken(ctx, uid, botId);

            return (await Store.User.findById(ctx, botId))!;
        }),
        updateAppProfile: withAccount(async (parent, args, uid, orgId) => {
            return await inTx(parent, async (ctx) => {
                let botId = IDs.User.parse(args.appId);

                if (!await Modules.Bots.isAppOwner(ctx, uid, botId)) {
                    throw new AccessDeniedError();
                }
                let profile = await Modules.Users.profileById(ctx, botId);
                if (!profile) {
                    throw Error('Unable to find profile');
                }

                if (args.input.name !== undefined) {
                    await validate(
                        stringNotEmpty('Name can\'t be empty!'),
                        args.input.name,
                        'input.name'
                    );
                    profile.firstName = Sanitizer.sanitizeString(args.input.name)!;
                }
                if (args.input.about !== undefined) {
                    profile.about = Sanitizer.sanitizeString(args.input.about);
                }
                if (args.input.photoRef !== undefined) {
                    if (args.input.photoRef !== null) {
                        await Modules.Media.saveFile(ctx, args.input.photoRef.uuid);
                    }
                    profile.picture = Sanitizer.sanitizeImageRef(args.input.photoRef);
                }
                if (args.input.shortname !== undefined) {
                    if (args.input.shortname === null) {
                        let existing = await Modules.Shortnames.findShortname(ctx, 'user');
                        if (existing) {
                            existing.enabled = false;
                        }
                    } else {
                        await Modules.Shortnames.setShortName(ctx, args.input.shortname, 'user', botId, botId);
                    }
                }

                return (await Store.User.findById(ctx, botId))!;
            });
        }),
        deleteApp: withAccount(async (ctx, args, uid, orgId) => {
            let appId = IDs.User.parse(args.appId);
            return Modules.Bots.deleteApp(ctx, uid, appId);
        }),
        addAppToChat: withAccount(async (parent, args, uid, orgId) => {
            return await inTx(parent, async (ctx) => {
                let chatId = IDs.Conversation.parse(args.chatId);
                let appId = IDs.User.parse(args.appId);

                if (!await Modules.Bots.isAppOwner(ctx, uid, appId)) {
                    throw new AccessDeniedError();
                }

                await Modules.Messaging.room.checkAccess(ctx, uid, chatId);

                await Modules.Messaging.room.inviteToRoom(ctx, chatId, uid, [appId]);

                return await Modules.Bots.createChatHook(ctx, uid, appId, chatId);
            });
        }),
        userStorageSet: withAccount(async (parent, args, uid) => {
            return await inTx(parent, async (ctx) => {
                return await Modules.Bots.writeKeys(ctx, uid, args.namespace, args.data);
            });
        }),
    },
};
