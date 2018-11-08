import { CallContext } from './CallContext';
import { AccessDeniedError } from '../openland-errors/AccessDeniedError';
import { ErrorText } from '../openland-errors/ErrorText';
import { UserError } from '../openland-errors/UserError';
import { SecID } from '../openland-security/SecID';
import { GraphQLField, GraphQLFieldResolver, GraphQLObjectType, GraphQLSchema } from 'graphql';
import { FDB } from 'openland-module-db/FDB';
import { Modules } from 'openland-modules/Modules';

async function fetchPermissions(context: CallContext) {
    if (context.cache.has('permissions')) {
        return (await context.cache.get('permissions')) as Set<string>;
    }
    let res = Modules.Super.resolvePermissions({ uid: context.uid, oid: context.oid });
    context.cache.set('permissions', res);
    return await res;
}

async function fetchOrganizationId(context: CallContext) {
    // if (context.cache.has('org_id')) {
    //     return (await context.cache.get('org_id')) as number | null;
    // }
    // let res = DB.User.findById(context.uid).then((v) => v ? v.organizationId as number | null : null);
    // context.cache.set('org_id', res);
    return context.oid !== undefined ? context.oid : null;
}

export function withPermission<T = {}>(permission: string | string[], resolver: (args: T, context: CallContext) => any) {
    return async function (_: any, args: T, context: CallContext) {
        let permissions = await fetchPermissions(context);
        if (Array.isArray(permission)) {
            for (let p of permission) {
                if (permissions.has(p)) {
                    return resolver(args, context);
                }
            }
        } else if (permissions.has(permission)) {
            return resolver(args, context);
        } else {
            throw new AccessDeniedError(ErrorText.permissionDenied);
        }
    };
}

export function withPermissionOptional<T = {}, C = {}>(permission: string | string[], resolver: (args: T, context: CallContext, src: C) => any) {
    return async function (c: C, args: T, context: CallContext) {
        let permissions = await fetchPermissions(context);
        if (Array.isArray(permission)) {
            for (let p of permission) {
                if (permissions.has(p)) {
                    return resolver(args, context, c);
                }
            }
        } else if (permissions.has(permission)) {
            return resolver(args, context, c);
        } else {
            return null;
        }
    };
}

export function withAuth<T = {}>(resolver: (args: T, uid: number) => any) {
    return async function (_: any, args: T, context: CallContext) {
        if (!context.uid) {
            throw new AccessDeniedError(ErrorText.permissionDenied);
        }
        return resolver(args, context.uid!!);
    };
}

export function withAccount<T = {}>(resolver: (args: T, uid: number, org: number) => any) {
    return async function (_: any, args: T, context: CallContext) {
        if (!context.uid) {
            throw new AccessDeniedError(ErrorText.permissionDenied);
        }
        let res = await fetchOrganizationId(context);
        if (res === null) {
            throw new AccessDeniedError(ErrorText.permissionDenied);
        }

        return resolver(args, context.uid!!, res);
    };
}

export function withOrgOwner<T = {}>(resolver: (args: T, uid: number, org: number) => any) {
    return async function (_: any, args: T, context: CallContext) {
        if (!context.uid) {
            throw new AccessDeniedError(ErrorText.permissionDenied);
        }
        let res = await fetchOrganizationId(context);
        if (res === null) {
            throw new AccessDeniedError(ErrorText.permissionDenied);
        }

        let member = await FDB.OrganizationMember.findById(res, context.uid);

        if (member === null || member.status !== 'joined' || member.role !== 'admin') {
            throw new UserError(ErrorText.permissionOnlyOwner);
        }

        return resolver(args, context.uid!!, res);
    };
}

export function withUser<T = {}>(resolver: (args: T, uid: number) => any) {
    return async function (_: any, args: T, context: CallContext) {
        if (!context.uid) {
            throw new AccessDeniedError(ErrorText.permissionDenied);
        }
        return resolver(args, context.uid!!);
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

export function resolveID(id: SecID) {
    return function (src: { id: number }, args: any, context: CallContext) {
        return id.serialize(src.id);
    };
}

export function resolveUser<T extends { userId: number }>() {
    return function (src: T) {
        return FDB.User.findById(src.userId);
    };
}

type FieldHandler = (field: GraphQLField<any, any>, originalResolver: GraphQLFieldResolver<any, any, any>, root: any, args: any, context: any, info: any) => any;
export function wrapAllResolvers(schema: GraphQLSchema, f: FieldHandler) {
    let types = schema.getTypeMap();

    for (let typeName in types) {
        if (!Object.hasOwnProperty.call(types, typeName)) {
            continue;
        }

        let type = types[typeName];

        if (type instanceof GraphQLObjectType) {
            let fields = type.getFields();

            for (let fieldName in fields) {
                if (!Object.hasOwnProperty.call(fields, fieldName)) {
                    continue;
                }

                let field = fields[fieldName];

                let fieldResolve = field.resolve;
                if (field.resolve) {
                    field.resolve = async (root: any, args: any, context: CallContext, info: any) => {
                        return f(field, fieldResolve!, root, args, context, info);
                    };
                }
            }
        }
    }
    return schema;
}
