import { Repos } from '../../repositories/index';
import { CallContext } from '../utils/CallContext';
import { AreaPermissions } from '../../repositories/PermissionRepository';

export interface AreaContext {
    _areadId: number;
    _permissions: AreaPermissions;
}

export const Resolver = {
    Query: {
        area: async function (_: any, args: { slug: string }, context: CallContext) {
            let area = await Repos.Area.resolveArea(args.slug);
            let permissions = await Repos.Permissions.resolveAreaPermissions(area.id, context.uid);
            return {
                ...area,
                writeAccess: permissions.isOwner,
                
                _areadId: area.id,
                _permissions: permissions
            };
        }
    }
};