import { Modules } from 'openland-modules/Modules';
import { ErrorText } from 'openland-errors/ErrorText';
import { NotFoundError } from 'openland-errors/NotFoundError';
import { IDs } from 'openland-module-api/IDs';
import { Context } from '@openland/context';
import { Store } from 'openland-module-db/FDB';

export class PermissionsRepository {

    async resolvePermissions(ctx: Context, args: { uid: number | null | undefined, oid: number | null | undefined }) {
        let permissions = new Set<string>();

        //
        // User Based Permissions
        //
        if (args.uid) {
            let user = await Store.User.findById(ctx, args.uid);
            if (user == null) {
                throw new NotFoundError(ErrorText.unableToFindUser);
            }
            permissions.add('viewer');

            // Super Role
            let superRole = await this.superRole(ctx, args.uid);
            if (superRole !== false) {
                permissions.add(superRole);
                if (superRole === 'super-admin') {
                    permissions.add('software-developer');
                }
            }
        }

        //
        // Organization Based Permissions
        //
        if (args.uid && args.oid) {

            //
            // Membership
            //

            let members = await Store.OrganizationMember.user.findAll(ctx, 'joined', args.uid);
            for (let member of members) {
                permissions.add('org-' + IDs.Organization.serialize(member.oid) + '-member');
                if (member.role === 'admin') {
                    permissions.add('org-' + IDs.Organization.serialize(member.oid) + '-admin');
                }
            }
        }

        return permissions;
    }

    async superRole(ctx: Context, userId: number | null | undefined): Promise<string | false> {
        if (userId !== undefined && userId !== null) {
            let role = await Modules.Super.findSuperRole(ctx, userId);
            if (role !== null) {
                return role;
            }
            return false;
        } else {
            return false;
        }
    }
}