import { inTx } from '@openland/foundationdb';
import * as base64 from '../../openland-utils/base64';
import { randomBytes } from 'crypto';
import { Context } from '@openland/context';
import { Store } from 'openland-module-db/FDB';
import { injectable } from 'inversify';

@injectable()
export class AuthCodeRepository {

    async findSession(ctx: Context, sessionKey: string) {
        let res = await Store.AuthCodeSession.findById(ctx, sessionKey);
        if (res && res.enabled) {
            return res;
        } else {
            return res;
        }
    }

    async createSession(parent: Context, email: string, code: string) {
        return await inTx(parent, async (ctx) => {
            return Store.AuthCodeSession.create(ctx, base64.encodeBuffer(randomBytes(64)), {
                code,
                expires: Date.now() + 1000 * 60 * 10 /* 10 Minutes */,
                attemptsCount: 0,
                email,
                enabled: true,
                tokenId: null
            });
        });
    }
}
