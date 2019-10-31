import { injectable } from 'inversify';
import { startIFTTTBot } from './iftttBot';
import { inTx } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { Store } from '../openland-module-db/FDB';
import { randomKey, randomString } from '../openland-utils/random';
import { uuid } from '../openland-utils/uuid';
import * as base64 from '../openland-utils/base64';
import { randomBytes } from 'crypto';
import { Modules } from '../openland-modules/Modules';

type IFTTTConfig = {
    BotId: number;
    ClientId: string;
    ClientSecret: string;
    ServiceKey: string;
};

@injectable()
export class IFTTTModule {
    start = () => {
        // tslint:disable-next-line:no-floating-promises
        startIFTTTBot();
    }

    async createAuth(parent: Context, state: string, redirectUrl: string) {
        return await inTx(parent, async ctx => {
            let auth = await Store.IftttAuth.create(ctx, randomString(10), {
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
            return await Store.IftttAuthToken.create(ctx, uuid(), {
                uid,
                salt: base64.encodeBuffer(randomBytes(64)),
                enabled: true
            });
        });
    }

    async getConfig(parent: Context): Promise<IFTTTConfig|null> {
        return await inTx(parent, async ctx => {
            return await Modules.Super.getEnvVar<IFTTTConfig>(ctx, 'ifttt-config');
        });
    }
}