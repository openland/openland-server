import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { encoders } from '@openland/foundationdb';
import { Store } from 'openland-module-db/FDB';

@injectable()
export class NeedNotificationDeliveryRepository {

    setNeedNotificationDelivery = (ctx: Context, uid: number) => {

        let directory = Store.NeedNotificationFlagDirectory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.boolean);

        directory.set(ctx, ['email', uid], true);
        directory.set(ctx, ['push', uid], true);
    }

    resetNeedNotificationDelivery = (ctx: Context, kind: 'email' | 'push', uid: number) => {
        Store.NeedNotificationFlagDirectory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.boolean)
            .clear(ctx, [kind, uid]);
    }

    findAllUsersWithNotifications = async (ctx: Context, kind: 'email' | 'push') => {
        return (await Store.NeedNotificationFlagDirectory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.boolean)
            .range(ctx, [kind]))
            .map((v) => v.key[1] as number);
    }
}