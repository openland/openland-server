import { injectable } from 'inversify';
import { lazyInject } from '../../openland-modules/Modules.container';
import { AllEntities } from '../../openland-module-db/schema';
import { Context } from '@openland/context';
import { FEncoders } from '../../foundation-orm/encoding/FEncoders';

@injectable()
export class NeedDeliveryRepository {
    @lazyInject('FDB')
    private readonly entities!: AllEntities;

    setNeedNotificationDelivery = (ctx: Context, uid: number) => {

        let directory = this.entities.NotificationCenterNeedDeliveryFlagDirectory
            .withKeyEncoding(FEncoders.tuple)
            .withValueEncoding(FEncoders.boolean);

        directory.set(ctx, ['email', uid], true);
        directory.set(ctx, ['push', uid], true);
    }

    resetNeedNotificationDelivery = (ctx: Context, kind: 'email' | 'push', uid: number) => {
        this.entities.NotificationCenterNeedDeliveryFlagDirectory
            .withKeyEncoding(FEncoders.tuple)
            .withValueEncoding(FEncoders.boolean)
            .delete(ctx, [kind, uid]);
    }

    findAllUsersWithNotifications = async (ctx: Context, kind: 'email' | 'push') => {
        return (await this.entities.NotificationCenterNeedDeliveryFlagDirectory
            .withKeyEncoding(FEncoders.tuple)
            .withValueEncoding(FEncoders.boolean)
            .range(ctx, [kind]))
            .map((v) => v.key[1] as number);
    }
}