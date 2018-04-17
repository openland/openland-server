import { CallContext } from '../CallContext';
import { Repos } from '../../repositories';
import { DB } from '../../tables';

async function fetchPermissions(context: CallContext) {
    if (context.cache.has('permissions')) {
        return (await context.cache.get('permissions')) as string[];
    }
    let res = Repos.Permissions.resolvePermissions(context.uid);
    context.cache.set('permissions', res);
    return await res;
}

async function fetchOrganizationId(context: CallContext) {
    if (context.cache.has('org_id')) {
        return (await context.cache.get('org_id')) as number | null;
    }
    let res = DB.User.findById(context.uid).then((v) => v ? v.organizationId as number | null : null);
    context.cache.set('org_id', res);
    return await res;
}

export function withPermission<T = {}>(permission: string | string[], resolver: (args: T, context: CallContext) => any) {
    return async function (_: any, args: T, context: CallContext) {
        let permissions = await fetchPermissions(context);
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

export function withPermissionOptional<T = {}, C = {}>(permission: string | string[], resolver: (args: T, context: CallContext, src: C) => any) {
    return async function (c: C, args: T, context: CallContext) {
        let permissions = await fetchPermissions(context);
        if (Array.isArray(permission)) {
            for (let p of permission) {
                if (permissions.indexOf(p) >= 0) {
                    return resolver(args, context, c);
                }
            }
        } else if (permissions.indexOf(permission) >= 0) {
            return resolver(args, context, c);
        } else {
            return null;
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
        let res = await fetchOrganizationId(context);
        if (res === null) {
            throw Error('Access Denied');
        }

        return resolver(args, context.uid!!, res);
    };
}

export function withAccountTypeOptional<T = {}>(resolver: (args: T, uid?: number, org?: number) => any) {
    return async function (args: T, _: any, context: CallContext) {
        let uid = context.uid;
        let org: number | undefined = undefined;
        if (context.uid) {
            let res = await fetchOrganizationId(context);
            if (res) {
                org = res;
            }  
        }
        return resolver(args, uid, org);
    };
}

    export function withAny<T = {}>(resolver: (args: T, context: CallContext) => any) {
        return async function (_: any, args: T, context: CallContext) {
            return resolver(args, context);
        };
    }