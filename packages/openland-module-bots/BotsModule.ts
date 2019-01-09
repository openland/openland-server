import { injectable } from 'inversify';
import { lazyInject } from '../openland-modules/Modules.container';
import { BotsRepository } from './repositories/BotsRepository';
import { Context } from '../openland-utils/Context';

@injectable()
export class BotsModule {
    @lazyInject('BotsRepository')
    private readonly repo!: BotsRepository;

    start = () => {

        // Nothing to do
    }

    async createBot(ctx: Context, uid: number, name: string, shortname: string) {
        return this.repo.createBot(ctx, uid, name, shortname);
    }

    async findBotsCreatedByUser(ctx: Context, uid: number) {
        return this.repo.findBotsCreatedByUser(ctx, uid);
    }

    async getBotToken(ctx: Context, botId: number) {
        return this.repo.getBotToken(ctx, botId);
    }

    async refreshBotToken(ctx: Context, uid: number, botId: number) {
        return this.repo.refreshBotToken(ctx, uid, botId);
    }
}