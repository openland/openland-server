import { IDs } from '../IDs';
import { Modules } from 'openland-modules/Modules';
import { createTracer } from 'openland-log/createTracer';
import { createEmptyContext } from 'openland-utils/Context';
import { AuthContext } from 'openland-module-auth/AuthContext';
import { TracingContext } from 'openland-log/src/TracingContext';
import { CacheContext } from 'openland-module-api/CacheContext';
import { AppContext } from 'openland-modules/AppContext';
import { withCache } from 'foundation-orm/withCache';

const tracer = createTracer('ws');

export async function fetchWebSocketParameters(args: any, websocket: any) {
    let res: any = {};
    if ('x-openland-token' in args) {
        let token = args['x-openland-token'] as string;
        let uid = await Modules.Auth.findToken(createEmptyContext(), token);
        if (uid !== null) {
            res.uid = uid.uid;
            res.tid = uid.uuid;
            let accounts = await Modules.Orgs.findUserOrganizations(createEmptyContext(), res.uid);
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
                        console.debug(e);
                    }
                }
            } else {
                // Default behaviour: pick the default one
                if (accounts.length >= 1) {
                    res.oid = accounts[0];

                    let profile = await Modules.Users.profileById(createEmptyContext(), res.uid);
                    res.oid = (profile && profile.primaryOrganization) || res.oid;
                }
            }
        }
    }
    return res;
}

export function buildWebSocketContext(args: any) {
    let res = createEmptyContext();
    if (args.uid && args.tid) {
        res = AuthContext.set(res, { uid: args.uid, tid: args.tid });
    }
    if (args.oid) {
        res = AuthContext.set(res, { ...AuthContext.get(res), oid: args.oid });
    }
    res = TracingContext.set(res, { span: tracer.startSpan('op') });
    res = CacheContext.set(res, new Map());
    res = withCache(res);
    return new AppContext(res);
}