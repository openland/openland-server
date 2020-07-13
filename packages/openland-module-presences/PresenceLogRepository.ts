import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { Store } from '../openland-module-db/FDB';
import { encoders } from '@openland/foundationdb';

@injectable()
export class PresenceLogRepository {
    logOnline(ctx: Context, date: number, uid: number, platform: 'undefined' | 'web' | 'ios' | 'android' | 'desktop') {
        let platformToCode = {
            undefined: 0,
            web: 1,
            ios: 2,
            android: 3,
            desktop: 4
        };
        Store.PresenceLogDirectory
            .withKeyEncoding(encoders.tuple)
            .set(ctx, [date - date % (60 * 1000), uid, platformToCode[platform]], Buffer.from([]));

    }
}