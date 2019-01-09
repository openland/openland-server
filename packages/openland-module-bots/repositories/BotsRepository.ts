import { injectable } from 'inversify';
import { lazyInject } from '../../openland-modules/Modules.container';
import { AllEntities } from '../../openland-module-db/schema';
import { Context } from '../../openland-utils/Context';
import { inTx } from '../../foundation-orm/inTx';
import { Modules } from '../../openland-modules/Modules';
import { AccessDeniedError } from '../../openland-errors/AccessDeniedError';
import { errors } from 'elasticsearch';
import InternalServerError = errors.InternalServerError;

@injectable()
export class BotsRepository {
    @lazyInject('FDB')
    private readonly entities!: AllEntities;

    async createBot(parent: Context, uid: number, name: string) {
        return await inTx(parent, async (ctx) => {
            if (!await this.canCreateBot(ctx, uid)) {
                throw new AccessDeniedError();
            }

            let botUser = await Modules.Users.createUser(ctx, 'user-bot', 'bots@openland.com');
            await Modules.Users.activateUser(ctx, botUser.id);
            botUser.isBot = true;
            botUser.botOwner = uid;

            await Modules.Users.createUserProfile(ctx, botUser.id, { firstName: name, email: 'bots@openland.com' });
            await Modules.Auth.createToken(ctx, botUser.id);

            return botUser;
        });
    }

    async findBotsCreatedByUser(parent: Context, uid: number) {
        return await inTx(parent, async (ctx) => {
            return await this.entities.User.allFromOwner(ctx, uid);
        });
    }

    async getBotToken(parent: Context, botId: number) {
        return await inTx(parent, async (ctx) => {
            let tokens = await this.entities.AuthToken.allFromUser(ctx, botId);

            console.log('bot tokens:', botId, tokens.length);

            if (tokens.length === 0) {
                throw new InternalServerError();
            }

            return tokens[0];
        });
    }

    async refreshBotToken(parent: Context, uid: number, botId: number) {
        return await inTx(parent, async (ctx) => {
            if (!this.isBotOwner(ctx,  uid, botId)) {
                throw new AccessDeniedError();
            }
            let token = await this.getBotToken(ctx, botId);
            await Modules.Auth.revokeToken(ctx, token.salt);
            await Modules.Auth.createToken(ctx, botId);
        });
    }

    private async canCreateBot(parent: Context, uid: number) {
        return await inTx(parent, async (ctx) => {
            let user = await this.entities.User.findById(ctx, uid);

            if (!user || user.status !== 'activated') {
                return false;
            }

            return true;
        });
    }

    private async isBotOwner(parent: Context, uid: number, botId: number) {
        return await inTx(parent, async (ctx) => {
            let bot = await this.entities.User.findById(ctx, botId);

            return bot && bot.botOwner === uid;
        });
    }
}