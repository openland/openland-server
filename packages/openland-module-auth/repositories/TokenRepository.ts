import DataLoader from 'dataloader';
import { AllEntities, AuthToken } from 'openland-module-db/schema';
import { uuid } from 'openland-utils/uuid';
import { randomBytes } from 'crypto';
import * as base64 from 'openland-utils/base64';
import { inTx } from 'foundation-orm/inTx';
import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import { EmptyContext, Context } from '@openland/context';

@injectable()
export class TokenRepository {

    @lazyInject('FDB')
    private readonly entities!: AllEntities;
    
    private readonly loader = new DataLoader<string, AuthToken | null>(async (tokens) => {
        let res: (AuthToken | null)[] = [];
        for (let i of tokens) {
            let token = await this.entities.AuthToken.findFromSalt(EmptyContext, i);
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
            return await this.entities.AuthToken.create(ctx, uuid(), {
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
            let authToken = await this.entities.AuthToken.findFromSalt(ctx, token);

            if (authToken) {
                authToken.enabled = false;
            }
            this.loader.clear(token);
        });
    }
}