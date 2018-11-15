import { AllEntities } from 'openland-module-db/schema';
import { Modules } from 'openland-modules/Modules';
import { ErrorText } from 'openland-errors/ErrorText';
import { NotFoundError } from 'openland-errors/NotFoundError';
import { IDs } from 'openland-module-api/IDs';
import { Context } from 'openland-utils/Context';

export class PermissionsRepository {
    private readonly entities: AllEntities;

    constructor(entities: AllEntities) {
        this.entities = entities;
    }

    async resolvePermissions(ctx: Context, args: { uid: number | null | undefined, oid: number | null | undefined }) {
        let permissions = new Set<string>();

        //
        // User Based Permissions
        //
        if (args.uid) {
            let user = await this.entities.User.findById(ctx, args.uid);
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

            let members = await this.entities.OrganizationMember.allFromUser(ctx, 'joined', args.uid);
            for (let member of members) {
                permissions.add('org-' + IDs.Organization.serialize(member.oid) + '-member');
                if (member.role === 'admin') {
                    permissions.add('org-' + IDs.Organization.serialize(member.oid) + '-admin');
                }
            }

            //
            // Organization features
            //
            let org = await this.entities.Organization.findById(ctx, args.oid);
            if (org) {
                let features = await Modules.Features.repo.findOrganizationFeatures(ctx, org.id!);
                for (let f of features) {
                    permissions.add('feature-' + f.featureKey);
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