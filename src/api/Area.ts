import { Repos } from '../repositories/index';
import { CallContext } from './CallContext';
import { AreaPermissions } from '../repositories/PermissionRepository';

export const Schema = `
    type Area {
        id: ID!
        slug: String!
        writeAccess: Boolean!
    }

    extend type Query {
        area(slug: String!): Area!
    }
`;

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