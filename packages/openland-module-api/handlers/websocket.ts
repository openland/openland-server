import { inTx } from '@openland/foundationdb';
import { IDs } from '../IDs';
import { Modules } from 'openland-modules/Modules';
import { AuthContext } from 'openland-module-auth/AuthContext';
import { CacheContext } from 'openland-module-api/CacheContext';
import { createNamedContext } from '@openland/context';
import { randomGlobalInviteKey } from 'openland-utils/random';
import { withLogMeta, createLogger } from '@openland/log';
import { setRequestContextFrom } from '../RequestContext';

let rootContext = createNamedContext('ws');
let rootContextResolve = createNamedContext('resolve');
let logger = createLogger('ws');

export async function fetchWebSocketParameters(args: any, websocket: any) {
    return await inTx(rootContext, async (ctx) => {
        let res: any = {};
        let token = args['x-openland-token'] as string | undefined;
        if (token) {
            let uid = await Modules.Auth.findToken(ctx, token);
            if (uid !== null) {
                res.uid = uid.uid;
                res.tid = uid.uuid;
                let accounts = await Modules.Orgs.findUserOrganizations(ctx, res.uid);
                if (accounts.length === 1) {
                    res.oid = accounts[0];
                }

                if ('x-openland-org' in args) {
                    let orgId = args['x-openland-org'] as string;
                    if (orgId) {
                        if (Array.isArray(orgId)) {
                            orgId = orgId[0];
                        }
                        try {
                            let porgId = IDs.Organization.parse(orgId as string);
                            if (accounts.indexOf(porgId) >= 0) {
                                res.oid = porgId;
                            }
                        } catch (e) {
                            logger.debug(ctx, e);
                        }
                    }
                } else {
                    // Default behaviour: pick the default one
                    if (accounts.length >= 1) {
                        res.oid = accounts[0];

                        let profile = await Modules.Users.profileById(ctx, res.uid);
                        res.oid = (profile && profile.primaryOrganization) || res.oid;
                    }
                }
            }
        }
        return res;
    });
}

export function buildWebSocketContext(args: any, ipHeader?: string, latLongHeader?: string) {
    let res = rootContextResolve;
    res = setRequestContextFrom(res, ipHeader, latLongHeader);
    if (args.uid && args.tid) {
        res = AuthContext.set(res, { uid: args.uid, tid: args.tid });
        res = withLogMeta(res, { uid: args.uid, tid: args.tid });
    }
    if (args.oid) {
        res = AuthContext.set(res, { ...AuthContext.get(res), oid: args.oid });
    }
    res = CacheContext.set(res, new Map());
    res = withLogMeta(res, { connection: randomGlobalInviteKey(8) });

    return res;
}