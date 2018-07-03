import { Repos } from '../repositories';
import { IDs } from '../api/utils/IDs';
import { CallContext } from '../api/utils/CallContext';

export async function fetchWebSocketParameters(args: any, websocket: any) {
    let res: any = {};
    if ('x-openland-token' in args) {
        let token = args['x-openland-token'] as string;
        let uid = await Repos.Tokens.fetchUserByToken(token);
        if (uid !== null) {
            res.uid = uid;
            let accounts = await Repos.Users.fetchUserAccounts(res.uid);
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
                        console.warn(e);
                    }
                }
            }
        }
    }
    return res;
}

export function buildWebSocketContext(args: any) {
    let res = new CallContext();
    if (args.uid) {
        res.uid = args.uid;
    }
    if (args.oid) {
        res.oid = args.oid;
    }
    return res;
}