import DataLoader from 'dataloader';
import * as base64 from 'openland-utils/base64';
import { AuthToken } from 'openland-module-db/schema';
import { FDB } from 'openland-module-db/FDB';
import { inTx } from 'foundation-orm/inTx';
import { uuid } from 'openland-utils/uuid';
import { randomBytes } from 'crypto';

export class AuthModule {
    private loader = new DataLoader<string, AuthToken | null>(async (tokens) => {
        let res: (AuthToken | null)[] = [];
        for (let i of tokens) {
            res.push(await FDB.AuthToken.findFromSalt(i));
        }
        return res;
    });

    start = () => {
        //
    }

    async createToken(uid: number) {
        let res = await inTx(async () => {
            return await FDB.AuthToken.create(uuid(), {
                uid,
                salt: base64.encodeBuffer(randomBytes(64)),
                lastIp: ''
            });
        });
        return res;
    }

    async findToken(token: string) {
        return this.loader.load(token);
    }
}