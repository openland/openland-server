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

    async nextAuthEmailTime(parent: Context, email: string) {
        return inTx(parent, async ctx => {
            let lastEmail = await Store.LastAuthEmailSentTime.get(ctx, email);
            let emailsSent = await Store.AuthEmailsSentCount.get(ctx, email);
            if (emailsSent === 0 || lastEmail === 0) {
                return null;
            }
            let timeout = emailsSent * 5;
            let now = Math.floor(Date.now() / 1000);
            let nextTime = lastEmail + timeout;
            if (now > nextTime) {
                return null;
            } else {
                return nextTime;
            }
        });
    }

    async onAuthEmailSent(parent: Context, email: string) {
        return inTx(parent, async ctx => {
            Store.AuthEmailsSentCount.increment(ctx, email);
            Store.LastAuthEmailSentTime.set(ctx, email, Math.floor(Date.now() / 1000));
        });
    }

    async onAuthCodeUsed(parent: Context, email: string) {
        return inTx(parent, async ctx => {
            Store.LastAuthEmailSentTime.set(ctx, email, 0);
            Store.AuthEmailsSentCount.set(ctx, email, 0);
        });
    }
}
