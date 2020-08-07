import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { encoders } from '@openland/foundationdb';
import { Store } from 'openland-module-db/FDB';

@injectable()
export class NeedDeliveryRepository {

    setNeedNotificationDelivery = (ctx: Context, uid: number) => {

        let directory = Store.NotificationCenterNeedDeliveryFlagDirectory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.boolean);

        directory.set(ctx, ['email', uid], true);
        directory.set(ctx, ['push', uid], true);
    }

    resetNeedNotificationDelivery = (ctx: Context, kind: 'email' | 'push', uid: number) => {
        Store.NotificationCenterNeedDeliveryFlagDirectory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.boolean)
            .clear(ctx, [kind, uid]);
    }

    findAllUsersWithNotifications = async (ctx: Context, kind: 'email' | 'push', limit: number | undefined = undefined) => {
        return (await Store.NotificationCenterNeedDeliveryFlagDirectory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.boolean)
            .snapshotRange(ctx, [kind], { limit: limit }))
            .map((v) => v.key[1] as number);
    }
}