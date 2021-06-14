import { Context } from '@openland/context';
import { Store } from '../openland-module-db/FDB';

export async function fetchSessionLanguage(ctx: Context, tid: string) {
    let token = await Store.AuthToken.findById(ctx, tid);
    if (!token) {
        return 'EN';
    }

    return token.language || 'EN';
}