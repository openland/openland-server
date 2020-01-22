import { AuthCodeRepository } from './repositories/AuthCodeRepository';
import { injectable, inject } from 'inversify';
import { TokenRepository } from './repositories/TokenRepository';
import { Context } from '@openland/context';
import { inTx } from '@openland/foundationdb';
import { Store } from '../openland-module-db/FDB';

@injectable()
export class AuthModule {
    private readonly codeRepo = new AuthCodeRepository();
    private readonly tokenRepo!: TokenRepository;

    constructor(
        @inject('TokenRepository') tokenRepo: TokenRepository
    ) {
        this.tokenRepo = tokenRepo;
    }

    start = () => {
        //
    }

    async findAuthSession(ctx: Context, sessionKey: string) {
        return await this.codeRepo.findSession(ctx, sessionKey);
    }

    async createEmailAuthSession(ctx: Context, email: string, code: string) {
        return await this.codeRepo.createSession(ctx, email, code);
    }

    async createToken(ctx: Context, uid: number) {
        return await this.tokenRepo.createToken(ctx, uid);
    }

    async findToken(ctx: Context, token: string) {
        return await this.tokenRepo.findToken(token);
    }

    async revokeToken(ctx: Context, token: string) {
        return await this.tokenRepo.revokeToken(ctx, token);
    }

    async revokeUserTokens(ctx: Context, uid: number) {
        return await this.tokenRepo.revokeUserTokens(ctx, uid);
    }

    async canSendAuthEmail(parent: Context, email: string) {
        return inTx(parent, async ctx => {
            let lastEmail = await Store.LastAuthEmailSentTime.get(ctx, email);
            if (!lastEmail) {
                return true;
            }

            if ((Math.floor(Date.now() / 1000) - lastEmail) < 60 * 5) {
                return false;
            }

            return true;
        });
    }

    async onAuthEmailSent(parent: Context, email: string) {
        return inTx(parent, async ctx => {
            Store.LastAuthEmailSentTime.set(ctx, email, Math.floor(Date.now() / 1000));
        });
    }
}
