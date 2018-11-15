import { AllEntities } from 'openland-module-db/schema';
import * as base64 from '../../openland-utils/base64';
import { randomBytes } from 'crypto';
import { inTx } from 'foundation-orm/inTx';
import { Context } from 'openland-utils/Context';

export class AuthCodeRepository {
    private readonly entities: AllEntities;

    constructor(entities: AllEntities) {
        this.entities = entities;
    }

    async findSession(ctx: Context, sessionKey: string) {
        let res = await this.entities.AuthCodeSession.findById(ctx, sessionKey);
        if (res && res.enabled) {
            return res;
        } else {
            return res;
        }
    }

    async createSession(parent: Context, email: string, code: string) {
        return await inTx(parent, async (ctx) => {
            return this.entities.AuthCodeSession.create(ctx, base64.encodeBuffer(randomBytes(64)), {
                code,
                expires: Date.now() + 1000 * 60 * 5 /* 5 Minutes */,
                email,
                enabled: true
            });
        });
    }
}