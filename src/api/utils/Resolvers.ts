import { CallContext } from '../CallContext';
import { Repos } from '../../repositories';

export function withPermission<T>(permission: string, resolver: (args: T) => any) {
    return async function (_: any, args: T, context: CallContext) {
        let permissions = await Repos.Permissions.resolvePermissions(context.uid);
        if (permissions.indexOf(permission) >= 0) {
            return resolver(args);
        } else {
            throw Error('Access Denied');
        }
    };
}