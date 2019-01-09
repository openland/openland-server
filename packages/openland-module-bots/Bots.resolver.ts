import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { Modules } from '../openland-modules/Modules';
import { withAccount } from '../openland-module-api/Resolvers';
import { IDs } from '../openland-module-api/IDs';
import { AccessDeniedError } from '../openland-errors/AccessDeniedError';
import { stringNotEmpty, validate } from '../openland-utils/NewInputValidator';
import { Sanitizer } from '../openland-utils/Sanitizer';
import { UserError } from '../openland-errors/UserError';
import { inTx } from '../foundation-orm/inTx';

export default {
    Bot: {
        bot: root => root,
        token: async (root, args, ctx) => {
            let token = await Modules.Bots.getBotToken(ctx, root.id);

            return { salt: token.salt };
        }
    },

    Query: {
        myBots: withAccount(async (ctx, args, uid, orgId) => {
            return await Modules.Bots.findBotsCreatedByUser(ctx, uid);
        })
    },

    Mutation: {
        createBot: withAccount(async (ctx, args, uid, orgId) => {
            return await Modules.Bots.createBot(ctx, uid, args.name, args.shortname);
        }),
        refreshBotToken: withAccount(async (ctx, args, uid, orgId) => {
            let botId = IDs.User.parse(args.botId);

            await Modules.Bots.refreshBotToken(ctx, uid, botId);

            return Modules.DB.entities.User.findById(ctx, botId);
        }),
        updateBotProfile: withAccount(async (parent, args, uid, orgId) => {
            return await inTx(parent, async (ctx) => {
                let botId = IDs.User.parse(args.botId);

                if (!await Modules.Bots.isBotOwner(ctx, uid, botId)) {
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
                        throw new UserError('Bot should have shortname');
                    }

                    await Modules.Shortnames.setShortnameToUser(ctx, args.input.shortname, botId);
                }

                return Modules.DB.entities.User.findById(ctx, botId);
            });
        }),
    },
} as GQLResolver;