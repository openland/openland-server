import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { Modules } from '../openland-modules/Modules';
import { withAccount } from '../openland-module-api/Resolvers';
import { IDs } from '../openland-module-api/IDs';

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
            return await Modules.Bots.createBot(ctx, uid, args.name);
        }),
        refreshBotToken: withAccount(async (ctx, args, uid, orgId) => {
            let botId = IDs.User.parse(args.botId);

            await Modules.Bots.refreshBotToken(ctx, uid, botId);

            return Modules.DB.entities.User.findById(ctx, botId);
        }),
    },
} as GQLResolver;