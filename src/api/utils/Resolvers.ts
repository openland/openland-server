import { CallContext } from '../CallContext';
import { Repos } from '../../repositories';
import { DB } from '../../tables';

export function withPermission<T = {}>(permission: string | string[], resolver: (args: T, context: CallContext) => any) {
    return async function (_: any, args: T, context: CallContext) {
        let permissions = await Repos.Permissions.resolvePermissions(context.uid);
        if (Array.isArray(permission)) {
            for (let p of permission) {
                if (permissions.indexOf(p) >= 0) {
                    return resolver(args, context);
                }
            }
        } else if (permissions.indexOf(permission) >= 0) {
            return resolver(args, context);
        } else {
            throw Error('Access Denied');
        }
    };
}

export function withAuth<T = {}>(resolver: (args: T, uid: number) => any) {
    return async function (_: any, args: T, context: CallContext) {
        if (!context.uid) {
            throw Error('Access Denied');
        }
        return resolver(args, context.uid!!);
    };
}

export function withAccount<T = {}>(resolver: (args: T, uid: number, org: number) => any) {
    return async function (_: any, args: T, context: CallContext) {
        if (!context.uid) {
            throw Error('Access Denied');
        }
        let res = await DB.User.findById(context.uid, { include: [{ model: DB.Organization, as: 'organization' }] });
        if (res === null || res.organization === null) {
            throw Error('Access Denied');
        }

        return resolver(args, context.uid!!, res.organizationId!!);
    };
}

export function withAny<T = {}>(resolver: (args: T) => any) {
    return async function (_: any, args: T, context: CallContext) {
        return resolver(args);
    };
}