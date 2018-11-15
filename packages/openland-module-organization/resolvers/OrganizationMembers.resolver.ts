import { withAccount } from 'openland-module-api/Resolvers';
import { inTx } from 'foundation-orm/inTx';
import { IDs } from 'openland-module-api/IDs';
import { UserError } from 'openland-errors/UserError';
import { ErrorText } from 'openland-errors/ErrorText';
import { validate, defined, emailValidator } from 'openland-utils/NewInputValidator';
import { Modules } from 'openland-modules/Modules';
import { AccessDeniedError } from 'openland-errors/AccessDeniedError';
import { Emails } from 'openland-module-email/Emails';
import { resolveOrganizationJoinedMembers } from './utils/resolveOrganizationJoinedMembers';

export default {
    OrganizationMember: {
        __resolveType(src: any) {
            return src._type;
        }
    },
    Query: {
        alphaOrganizationMembers: withAccount<{ orgId: string }>(async (ctx, args, uid, orgId) => {
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
        alphaOrganizationInviteLink: withAccount<{ organizationId?: string }>(async (ctx, args, uid, organizationId) => {
            organizationId = args.organizationId ? IDs.Organization.parse(args.organizationId) : organizationId;
            return await Modules.Invites.orgInvitesRepo.getOrganizationInviteLink(ctx, organizationId, uid);
        }),
        // deperecated
        alphaOrganizationPublicInvite: withAccount<{ organizationId?: string }>(async (ctx, args, uid, organizationId) => {
            organizationId = args.organizationId ? IDs.Organization.parse(args.organizationId) : organizationId;
            return await Modules.Invites.orgInvitesRepo.getOrganizationInviteLink(ctx, organizationId, uid);
        }),
    },
    Mutation: {
        alphaOrganizationRemoveMember: withAccount<{ memberId: string, organizationId: string }>(async (ctx, args, uid) => {
            let oid = IDs.Organization.parse(args.organizationId);
            let memberId = IDs.User.parse(args.memberId);
            await Modules.Orgs.removeUserFromOrganization(ctx, memberId, oid, uid);
            return 'ok';
        }),
        alphaOrganizationChangeMemberRole: withAccount<{ memberId: string, newRole: 'OWNER' | 'MEMBER', organizationId: string }>(async (ctx, args, uid) => {
            let oid = IDs.Organization.parse(args.organizationId);
            let memberId = IDs.User.parse(args.memberId);
            await Modules.Orgs.updateMemberRole(ctx, memberId, oid, args.newRole === 'OWNER' ? 'admin' : 'member', uid);
            return 'ok';
        }),

        alphaOrganizationInviteMembers: withAccount<{ inviteRequests: { email: string, emailText?: string, firstName?: string, lastName?: string, role: 'OWNER' | 'MEMBER' }[], organizationId?: string }>(async (parent, args, uid, oid) => {
            oid = args.organizationId ? IDs.Organization.parse(args.organizationId) : oid;
            await validate({ inviteRequests: [{ email: defined(emailValidator) }] }, args);

            return await inTx(parent, async (ctx) => {
                for (let inviteRequest of args.inviteRequests) {
                    let isMemberDuplicate = await Modules.Orgs.hasMemberWithEmail(ctx, oid, inviteRequest.email);
                    if (isMemberDuplicate) {
                        throw new UserError(ErrorText.memberWithEmailAlreadyExists);
                    }

                    let invite = await Modules.Invites.orgInvitesRepo.createOrganizationInvite(
                        ctx,
                        oid,
                        uid,
                        inviteRequest.firstName || '',
                        inviteRequest.lastName || '',
                        inviteRequest.email,
                        inviteRequest.emailText || '',
                        inviteRequest.role,
                    );

                    await Emails.sendInviteEmail(ctx, oid, invite);
                }
                return 'ok';
            });
        }),
        alphaOrganizationRefreshInviteLink: withAccount<{ expirationDays?: number, organizationId?: string }>(async (parent, args, uid, oid) => {
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
        alphaOrganizationCreatePublicInvite: withAccount<{ expirationDays?: number, organizationId?: string }>(async (parent, args, uid, oid) => {
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
        alphaOrganizationDeletePublicInvite: withAccount<{ organizationId?: string }>(async (ctx, args, uid, oid) => {
            // oid = args.organizationId ? IDs.Organization.parse(args.organizationId) : oid;
            // return inTx(async () => {
            //     let isOwner = await Modules.Orgs.isUserAdmin(uid, oid);

            //     if (!isOwner) {
            //         throw new UserError(ErrorText.permissionOnlyOwner);
            //     }

            //     await Modules.Invites.orgInvitesRepo.deletePublicOrganizationInvite(oid, uid);
            //     return 'ok';
            // });
        })
    }
};