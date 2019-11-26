import { AuthCodeRepository } from './repositories/AuthCodeRepository';
import { injectable, inject } from 'inversify';
import { TokenRepository } from './repositories/TokenRepository';
import { Context } from '@openland/context';

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
}