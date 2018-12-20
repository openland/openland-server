import DataLoader from 'dataloader';
import { AllEntities, AuthToken } from 'openland-module-db/schema';
import { uuid } from 'openland-utils/uuid';
import { randomBytes } from 'crypto';
import * as base64 from 'openland-utils/base64';
import { inTx } from 'foundation-orm/inTx';
import { Context, createEmptyContext } from 'openland-utils/Context';
import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';

@injectable()
export class TokenRepository {

    @lazyInject('FDB')
    private readonly entities!: AllEntities;
    
    private readonly loader = new DataLoader<string, AuthToken | null>(async (tokens) => {
        let res: (AuthToken | null)[] = [];
        for (let i of tokens) {
            res.push(await this.entities.AuthToken.findFromSalt(createEmptyContext(), i));
        }
        return res;
    });

    async createToken(parent: Context, uid: number) {
        return await inTx(parent, async (ctx) => {
            return await this.entities.AuthToken.create(ctx, uuid(), {
                uid,
                salt: base64.encodeBuffer(randomBytes(64)),
                lastIp: ''
            });
        });
    }

    async findToken(token: string) {
        return this.loader.load(token);
    }
}