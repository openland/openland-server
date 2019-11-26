import { AuthToken } from './../../openland-module-db/store';
import { inTx } from '@openland/foundationdb';
import DataLoader from 'dataloader';
import { uuid } from 'openland-utils/uuid';
import { randomBytes } from 'crypto';
import * as base64 from 'openland-utils/base64';
import { injectable } from 'inversify';
import { Context, createNamedContext } from '@openland/context';
import { Store } from 'openland-module-db/FDB';
import { EventBus } from '../../openland-module-pubsub/EventBus';

const rootCtx = createNamedContext('token-loader');

@injectable()
export class TokenRepository {

    private readonly loader = new DataLoader<string, AuthToken | null>(async (tokens) => {
        let res: (AuthToken | null)[] = [];
        for (let i of tokens) {
            let token = await inTx(rootCtx, async (ctx) => await Store.AuthToken.salt.find(ctx, i));
            if (token && token.enabled !== false) {
                res.push(token);
            } else {
                res.push(null);
            }
        }
        return res;
    });

    async createToken(parent: Context, uid: number) {
        return await inTx(parent, async (ctx) => {
            return await Store.AuthToken.create(ctx, uuid(), {
                uid,
                salt: base64.encodeBuffer(randomBytes(64)),
                lastIp: '',
                enabled: true
            });
        });
    }

    async findToken(token: string) {
        return this.loader.load(token);
    }

    async revokeToken(parent: Context, token: string) {
        return await inTx(parent, async (ctx) => {
            let authToken = await Store.AuthToken.salt.find(ctx, token);

            if (authToken) {
                authToken.enabled = false;
                await EventBus.publish('auth_token_revoke', { tokens: [{ uuid: authToken.uuid, salt: authToken.salt }] });
            }
            this.loader.clear(token);
        });
    }

    async revokeUserTokens(parent: Context, uid: number) {
        await inTx(parent, async ctx => {
            let tokens = await Store.AuthToken.user.findAll(ctx, uid);
            tokens.forEach(t => t.enabled = false);
            tokens.forEach(t => this.loader.clear(t.salt));
            await EventBus.publish('auth_token_revoke', { tokens: tokens.map(t => ({ uuid: t.uuid, salt: t.salt})) });
        });
    }
}