import { AuthCodeRepository } from './repositories/AuthCodeRepository';
import { injectable } from 'inversify';
import { TokenRepository } from './repositories/TokenRepository';
import { Context } from '@openland/context';
import { lazyInject } from '../openland-modules/Modules.container';
import { AuthManagementMediator } from './mediators/AuthManagementMediator';
import { SessionsMediator } from './mediators/SessionsMediator';

@injectable()
export class AuthModule {
    @lazyInject('AuthCodeRepository')
    private readonly codeRepo!: AuthCodeRepository;
    @lazyInject('TokenRepository')
    private readonly tokenRepo!: TokenRepository;
    @lazyInject('AuthManagementMediator')
    public readonly authManagement!: AuthManagementMediator;
    @lazyInject('SessionsMediator')
    public readonly sessions!: SessionsMediator;

    start = () => {
        //
    }

    //
    // Email auth
    //
    async findEmailAuthSession(ctx: Context, sessionKey: string) {
        return await this.codeRepo.findSession(ctx, sessionKey);
    }

    async createEmailAuthSession(ctx: Context, email: string, code: string) {
        return await this.codeRepo.createSession(ctx, email, code);
    }

    //
    // Auth Tokens management
    //
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
