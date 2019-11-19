import { injectable } from 'inversify';
import { startZapierBot } from './zapierBot';
import { inTx } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { Store } from '../openland-module-db/FDB';
import { randomKey, randomString } from '../openland-utils/random';
import { uuid } from '../openland-utils/uuid';
import * as base64 from '../openland-utils/base64';
import { randomBytes } from 'crypto';
import { Modules } from '../openland-modules/Modules';

type ZapierConfig = {
    BotId: number;
    ClientId: string;
    ClientSecret: string;
};

@injectable()
export class ZapierModule {
    start = () => {
        // tslint:disable-next-line:no-floating-promises
        startZapierBot();
    }

    async createAuth(parent: Context, state: string, redirectUrl: string) {
        return await inTx(parent, async ctx => {
            let auth = await Store.ZapierAuth.create(ctx, randomString(10), {
                state: state,
                redirectUrl: redirectUrl,
                code: randomKey(),
                enabled: true
            });
            await auth.flush(ctx);
            return auth;
        });
    }

    async createToken(parent: Context, uid: number) {
        return await inTx(parent, async (ctx) => {
            return await Store.ZapierAuthToken.create(ctx, uuid(), {
                uid,
                salt: base64.encodeBuffer(randomBytes(64)),
                enabled: true
            });
        });
    }

    async getConfig(parent: Context): Promise<ZapierConfig | null> {
        return await inTx(parent, async ctx => {
            return await Modules.Super.getEnvVar<ZapierConfig>(ctx, 'zapier-config');
        });
    }
}