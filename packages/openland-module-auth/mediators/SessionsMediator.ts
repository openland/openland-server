import { Context } from '@openland/context';
import { TokenRepository } from '../repositories/TokenRepository';
import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import { Store } from '../../openland-module-db/FDB';
import { AuthToken, Presence } from '../../openland-module-db/store';
import { NotFoundError } from '../../openland-errors/NotFoundError';
import { AccessDeniedError } from '../../openland-errors/AccessDeniedError';

@injectable()
export class SessionsMediator {
    @lazyInject('TokenRepository')
    private readonly tokenRepo!: TokenRepository;

    async findActiveSessions(ctx: Context, uid: number) {
        let tokens = await this.tokenRepo.findActiveUserTokens(ctx, uid);
        let presences = await Store.Presence.user.findAll(ctx, uid);

        let sessions: { token: AuthToken, presence: Presence | undefined }[] = [];
        for (let token of tokens) {
            sessions.push({
                token,
                presence: presences.find(a => a.tid === token.uuid) || undefined,
            });
        }

        return sessions.sort((a, b) => (b.presence?.lastSeen || 0) - (a.presence?.lastSeen || 0));
    }

    async terminateSession(ctx: Context, uid: number, tid: string) {
        let token = await Store.AuthToken.findById(ctx, tid);
        if (!token) {
            throw new NotFoundError();
        }
        if (token.uid !== uid) {
            throw new AccessDeniedError();
        }
        await this.tokenRepo.revokeTokenById(ctx, tid);
    }

    async terminateAllSessionsExcept(ctx: Context, uid: number, tid: string) {
        let token = await Store.AuthToken.findById(ctx, tid);
        if (!token) {
            throw new NotFoundError();
        }
        if (token.uid !== uid) {
            throw new AccessDeniedError();
        }
        await this.tokenRepo.revokeUserTokens(ctx, uid, tid);
    }
}