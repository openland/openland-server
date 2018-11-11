import { FDB } from 'openland-module-db/FDB';
import { AuthCodeRepository } from './repositories/AuthCodeRepository';
import { injectable } from 'inversify';
import { TokenRepository } from './repositories/TokenRepository';

@injectable()
export class AuthModule {
    private readonly codeRepo = new AuthCodeRepository(FDB);
    private readonly tokenRepo = new TokenRepository(FDB);

    start = () => {
        //
    }

    async findAuthSession(sessionKey: string) {
        return await this.codeRepo.findSession(sessionKey);
    }

    async createEmailAuthSession(email: string, code: string) {
        return await this.codeRepo.createSession(email, code);
    }

    async createToken(uid: number) {
        return await this.tokenRepo.createToken(uid);
    }

    async findToken(token: string) {
        return await this.tokenRepo.findToken(token);
    }
}