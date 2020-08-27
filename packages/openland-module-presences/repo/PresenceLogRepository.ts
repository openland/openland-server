import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { Store } from 'openland-module-db/FDB';
import { encoders } from '@openland/foundationdb';

const ZERO = Buffer.from([]);

const PLATFORM_ID = {
    undefined: 0,
    web: 1,
    ios: 2,
    android: 3,
    desktop: 4
};

@injectable()
export class PresenceLogRepository {

    private readonly directory = Store.PresenceLogDirectory
        .withKeyEncoding(encoders.tuple);
    private readonly mobileDirectory = Store.PresenceMobileInstalledDirectory
        .withKeyEncoding(encoders.tuple)
        .withValueEncoding(encoders.boolean);

    logOnline(ctx: Context, date: number, uid: number, platform: 'undefined' | 'web' | 'ios' | 'android' | 'desktop') {
        this.directory
            .set(ctx, [date - date % (60 * 1000), uid, PLATFORM_ID[platform]], ZERO);
    }

    hasMobile = async (ctx: Context, uid: number) => {
        let ex = await this.mobileDirectory.get(ctx, [uid]);
        if (ex) {
            return true;
        } else {
            return false;
        }
    }

    setMobile = (ctx: Context, uid: number) => {
        this.mobileDirectory.set(ctx, [uid], true);
    }
}