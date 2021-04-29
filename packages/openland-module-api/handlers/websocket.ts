import { Modules } from 'openland-modules/Modules';
import { AuthContext } from 'openland-module-auth/AuthContext';
import { CacheContext } from 'openland-module-api/CacheContext';
import { createNamedContext } from '@openland/context';
import { randomGlobalInviteKey } from 'openland-utils/random';
import { withLogMeta } from '@openland/log';
import { setRequestContextFrom } from '../RequestContext';

let rootContextResolve = createNamedContext('resolve');

export async function fetchWebSocketParameters(args: any, websocket: any) {
    let res: any = {};
    let token = args['x-openland-token'] as string | undefined;
    if (token) {
        const uid = await Modules.Auth.findToken(token);
        if (uid !== null) {
            res.uid = uid.uid;
            res.tid = uid.uuid;
        }
    }
    return res;
}

export function buildWebSocketContext(args: any, ipHeader?: string, latLongHeader?: string, locationHeader?: string) {
    let res = rootContextResolve;
    res = setRequestContextFrom(res, ipHeader, latLongHeader, locationHeader);
    if (args.uid && args.tid) {
        res = AuthContext.set(res, { uid: args.uid, tid: args.tid });
        res = withLogMeta(res, { uid: args.uid, tid: args.tid });
    }
    res = CacheContext.set(res, new Map());
    res = withLogMeta(res, { connection: randomGlobalInviteKey(8) });

    return res;
}