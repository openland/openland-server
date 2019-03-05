import { withAccount } from 'openland-module-api/Resolvers';
import { inTx } from 'foundation-orm/inTx';
import { IDs } from 'openland-module-api/IDs';
import { UserError } from 'openland-errors/UserError';
import { ErrorText } from 'openland-errors/ErrorText';
import { validate, defined, emailValidator } from 'openland-utils/NewInputValidator';
import { Modules } from 'openland-modules/Modules';
import { AccessDeniedError } from 'openland-errors/AccessDeniedError';
import { resolveOrganizationJoinedMembers } from './utils/resolveOrganizationJoinedMembers';
import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { FDB } from 'openland-module-db/FDB';

export default {
    OrganizationMember: {
        __resolveType(src: any) {
            return src._type;
        }
    },
    Query: {
        alphaOrganizationMembers: withAccount(async (ctx, args, uid, orgId) => {
            let targetOrgId = IDs.Organization.parse(args.orgId);

            let isMember = await Modules.Orgs.isUserMember(ctx, uid, targetOrgId);

            if (!isMember) {
                throw new AccessDeniedError(ErrorText.permissionDenied);
            }

            let result: any[] = [];

            result.push(... await resolveOrganizationJoinedMembers(ctx, targetOrgId));

            let invites = await Modules.Invites.orgInvitesRepo.getOrganizationInvitesForOrganization(ctx, targetOrgId);

            for (let invite of invites) {
                result.push({
                    _type: 'OrganizationIvitedMember',
                    firstName: invite.firstName || '',
                    lastName: invite.lastName || '',
                    email: invite.email,
                    role: invite.role,
                    inviteId: invite.id
                });
            }

            return result;
        }),
        alphaOrganizationInviteLink: withAccount(async (ctx, args, uid, organizationId) => {
            organizationId = args.organizationId ? IDs.Organization.parse(args.organizationId) : organizationId;
            return await Modules.Invites.orgInvitesRepo.getOrganizationInviteLink(ctx, organizationId, uid);
        }),
        // deperecated
        alphaOrganizationPublicInvite: withAccount(async (ctx, args, uid, organizationId) => {
            organizationId = args.organizationId ? IDs.Organization.parse(args.organizationId) : organizationId;
            return await Modules.Invites.orgInvitesRepo.getOrganizationInviteLink(ctx, organizationId, uid);
        }),
    },
    Mutation: {
        betaOrganizationMemberRequestApprove: withAccount(async (ctx, args, uid) => {
            return await Modules.Orgs.addUserToOrganization(ctx, IDs.User.parse(args.userId), IDs.Organization.parse(args.organizationId), uid);
        }),
        betaOrganizationMemberRemove: withAccount(async (ctx, args, uid) => {
            await Modules.Orgs.removeUserFromOrganization(ctx, IDs.User.parse(args.userId), IDs.Organization.parse(args.organizationId), uid);
            return await FDB.Organization.findById(ctx, IDs.Organization.parse(args.organizationId));
        }),
        betaOrganizationMemberAdd: withAccount(async (ctx, args, uid) => {
            return await inTx(ctx, async (c) => {
                let toAdd = [...args.userIds || [], ...args.userId ? [args.userId] : []];
                for (let u of toAdd) {
                    await Modules.Orgs.addUserToOrganization(c, IDs.User.parse(u), IDs.Organization.parse(args.organizationId), uid);
                }
                return await FDB.Organization.findById(c, IDs.Organization.parse(args.organizationId));
            });
        }),
        // depricated
        alphaOrganizationRemoveMember: withAccount(async (ctx, args, uid) => {
            let oid = IDs.Organization.parse(args.organizationId);
            let memberId = IDs.User.parse(args.memberId);
            await Modules.Orgs.removeUserFromOrganization(ctx, memberId, oid, uid);
            return 'ok';
        }),
        alphaOrganizationChangeMemberRole: withAccount(async (ctx, args, uid) => {
            let oid = IDs.Organization.parse(args.organizationId);
            let memberId = IDs.User.parse(args.memberId);
            await Modules.Orgs.updateMemberRole(ctx, memberId, oid, args.newRole === 'OWNER' ? 'admin' : 'member', uid);
            return 'ok';
        }),

        alphaOrganizationInviteMembers: withAccount(async (parent, args, uid, oid) => {
            oid = args.organizationId ? IDs.Organization.parse(args.organizationId) : oid;
            await validate({ inviteRequests: [{ email: defined(emailValidator) }] }, args);

            return await inTx(parent, async (ctx) => {
                for (let inviteRequest of args.inviteRequests) {
                    await Modules.Invites.createOrganizationInvite(ctx, oid, uid, { email: inviteRequest.email, emailText: inviteRequest.emailText || undefined, firstName: inviteRequest.firstName || undefined, lastName: inviteRequest.firstName || undefined });
                }
                return 'ok';
            });
        }),
        alphaOrganizationRefreshInviteLink: withAccount(async (parent, args, uid, oid) => {
            return inTx(parent, async (ctx) => {
                oid = args.organizationId ? IDs.Organization.parse(args.organizationId) : oid;
                let isOwner = await Modules.Orgs.isUserAdmin(ctx, uid, oid);

                if (!isOwner) {
                    throw new UserError(ErrorText.permissionOnlyOwner);
                }

                return await Modules.Invites.orgInvitesRepo.refreshOrganizationInviteLink(ctx, oid, uid);
            });
        }),
        // deperecated
        alphaOrganizationCreatePublicInvite: withAccount(async (parent, args, uid, oid) => {
            return inTx(parent, async (ctx) => {
                oid = args.organizationId ? IDs.Organization.parse(args.organizationId) : oid;
                let isOwner = await Modules.Orgs.isUserAdmin(ctx, uid, oid);

                if (!isOwner) {
                    throw new UserError(ErrorText.permissionOnlyOwner);
                }

                return await Modules.Invites.orgInvitesRepo.refreshOrganizationInviteLink(ctx, oid, uid);
            });
        }),
        // deprecated
        alphaOrganizationDeletePublicInvite: withAccount(async (ctx, args, uid, oid) => {
            // oid = args.organizationId ? IDs.Organization.parse(args.organizationId) : oid;
            // return inTx(async () => {
            //     let isOwner = await Modules.Orgs.isUserAdmin(uid, oid);

            //     if (!isOwner) {
            //         throw new UserError(ErrorText.permissionOnlyOwner);
            //     }

            //     await Modules.Invites.orgInvitesRepo.deletePublicOrganizationInvite(oid, uid);
            //     return 'ok';
            // });
            return 'deprecated';
        })
    }
} as GQLResolver;