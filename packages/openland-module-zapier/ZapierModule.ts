import { injectable } from 'inversify';
import { inTx } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { Modules } from '../openland-modules/Modules';

type ZapierConfig = {
    BotId: number;
};

@injectable()
export class ZapierModule {
    start = async () => {
        // no op
    }

    async getConfig(parent: Context): Promise<ZapierConfig | null> {
        return await inTx(parent, async ctx => {
            return await Modules.Super.getEnvVar<ZapierConfig>(ctx, 'zapier-config');
        });
    }
}