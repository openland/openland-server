import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { encoders, transactional } from '@openland/foundationdb';
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

    resetNeedNotificationDeliveryForAllUsers(ctx: Context, kind: 'email' | 'push') {
        Store.NeedNotificationFlagDirectory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.boolean)
            .clear(ctx, [kind]);
    }

    @transactional
    async findAllUsersWithNotifications(ctx: Context, kind: 'email' | 'push', limit: number | undefined = undefined) {
        return (await Store.NeedNotificationFlagDirectory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.boolean)
            .snapshotRange(ctx, [kind], { limit }))
            .map((v) => v.key[1] as number);
    }
}