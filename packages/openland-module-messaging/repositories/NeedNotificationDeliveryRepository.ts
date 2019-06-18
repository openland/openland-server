import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import { AllEntities } from 'openland-module-db/schema';
import { Context } from '@openland/context';
import { encoders } from '@openland/foundationdb';

@injectable()
export class NeedNotificationDeliveryRepository {

    @lazyInject('FDB')
    private readonly entities!: AllEntities;

    setNeedNotificationDelivery = (ctx: Context, uid: number) => {

        let directory = this.entities.NeedNotificationFlagDirectory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.boolean);

        directory.set(ctx, ['email', uid], true);
        directory.set(ctx, ['push', uid], true);
    }

    resetNeedNotificationDelivery = (ctx: Context, kind: 'email' | 'push', uid: number) => {
        this.entities.NeedNotificationFlagDirectory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.boolean)
            .clear(ctx, [kind, uid]);
    }

    findAllUsersWithNotifications = async (ctx: Context, kind: 'email' | 'push') => {
        return (await this.entities.NeedNotificationFlagDirectory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.boolean)
            .range(ctx, [kind]))
            .map((v) => v.key[1] as number);
    }
}