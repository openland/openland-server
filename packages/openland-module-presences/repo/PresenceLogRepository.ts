import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { Store } from 'openland-module-db/FDB';
import { encoders } from '@openland/foundationdb';

const ZERO = Buffer.from([]);

@injectable()
export class PresenceLogRepository {

    private readonly directory = Store.PresenceLogDirectory
        .withKeyEncoding(encoders.tuple);

    logOnline(ctx: Context, date: number, uid: number, platform: 'undefined' | 'web' | 'ios' | 'android' | 'desktop') {
        let platformToCode = {
            undefined: 0,
            web: 1,
            ios: 2,
            android: 3,
            desktop: 4
        };
        this.directory
            .set(ctx, [date - date % (60 * 1000), uid, platformToCode[platform]], ZERO);
    }
}