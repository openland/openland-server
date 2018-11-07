import { withAccount } from 'openland-server/api/utils/Resolvers';
import { Repos } from 'openland-server/repositories';
import { inTx } from 'foundation-orm/inTx';
import { FDB } from 'openland-module-db/FDB';
import { IDs, IdsFactory } from 'openland-server/api/utils/IDs';
import { UserError } from 'openland-server/errors/UserError';
import { ErrorText } from 'openland-server/errors/ErrorText';
import { validate, defined, emailValidator } from 'openland-utils/NewInputValidator';
import { Modules } from 'openland-modules/Modules';
import { AccessDeniedError } from 'openland-server/errors/AccessDeniedError';
import { NotFoundError } from 'openland-server/errors/NotFoundError';
import { Emails } from 'openland-module-email/Emails';

export default {
    OrganizationMember: {
        __resolveType(src: any) {
            return src._type;
        }
    },
    Query: {
        alphaOrganizationMembers: withAccount<{ orgId: string }>(async (args, uid, orgId) => {
            let targetOrgId = IDs.Organization.parse(args.orgId);

            let isMember = await Modules.Orgs.isUserMember(uid, targetOrgId);

            if (!isMember) {
                throw new AccessDeniedError(ErrorText.permissionDenied);
            }

            let result: any[] = [];

            result.push(... await Repos.Organizations.getOrganizationJoinedMembers(targetOrgId));

            let invites = await Modules.Invites.repo.getOrganizationInvitesForOrganization(targetOrgId);

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
        alphaOrganizationPublicInvite: withAccount<{ organizationId?: string }>(async (args, uid, organizationId) => {
            organizationId = args.organizationId ? IDs.Organization.parse(args.organizationId) : organizationId;
            return await Modules.Invites.repo.getPublicOrganizationInvite(organizationId, uid);
        }),
    },
    Mutation: {

        alphaOrganizationRemoveMember: withAccount<{ memberId: string, organizationId: string }>(async (args, uid, oid) => {
            oid = args.organizationId ? IDs.Organization.parse(args.organizationId) : oid;
            return await inTx(async () => {
                let isOwner = await Repos.Organizations.isOwnerOfOrganization(oid, uid);

                let idType = IdsFactory.resolve(args.memberId);

                if (idType.type.typeName === 'User') {
                    let memberId = IDs.User.parse(args.memberId);

                    let member = await FDB.OrganizationMember.findById(oid, memberId);

                    if (!member) {
                        return 'ok';
                    }

                    let invitedByUser = (member.invitedBy && (member.invitedBy === uid)) || false;

                    if (!isOwner && !invitedByUser) {
                        throw new AccessDeniedError(ErrorText.permissionDenied);
                    }

                    if (isOwner && (memberId === uid)) {
                        throw new AccessDeniedError(ErrorText.permissionDenied);
                    }

                    member.status = 'left';

                    // await Emails.sendMemberRemovedEmail(oid, memberId, tx);
                    // pick new primary organization

                    let user = (await Modules.Users.profileById(memberId))!;
                    user.primaryOrganization = (await Modules.Orgs.findUserOrganizations(uid))[0];
                }

                return 'ok';
            });
        }),

        alphaOrganizationChangeMemberRole: withAccount<{ memberId: string, newRole: 'OWNER' | 'MEMBER', organizationId: string }>(async (args, uid, oid) => {
            oid = args.organizationId ? IDs.Organization.parse(args.organizationId) : oid;

            return await inTx(async () => {
                let isOwner = await Repos.Organizations.isOwnerOfOrganization(oid, uid);

                if (!isOwner) {
                    throw new UserError(ErrorText.permissionOnlyOwner);
                }

                let idType = IdsFactory.resolve(args.memberId);

                if (idType.type.typeName === 'User') {
                    let memberId = IDs.User.parse(args.memberId);

                    if (memberId === uid) {
                        throw new AccessDeniedError(ErrorText.permissionDenied);
                    }

                    let member = await FDB.OrganizationMember.findById(memberId, oid);

                    if (!member) {
                        throw new NotFoundError();
                    }

                    switch (args.newRole) {
                        case 'OWNER':
                            member.role = 'admin';
                            break;
                        case 'MEMBER':
                            member.role = 'member';
                            break;
                        default:
                            break;
                    }
                }

                return 'ok';
            });
        }),
        alphaOrganizationInviteMembers: withAccount<{ inviteRequests: { email: string, emailText?: string, firstName?: string, lastName?: string, role: 'OWNER' | 'MEMBER' }[], organizationId?: string }>(async (args, uid, oid) => {
            oid = args.organizationId ? IDs.Organization.parse(args.organizationId) : oid;
            await validate(
                {
                    inviteRequests: [
                        {
                            email: defined(emailValidator),
                        }
                    ]
                },
                args
            );

            return await inTx(async () => {
                for (let inviteRequest of args.inviteRequests) {
                    let isMemberDuplicate = await Repos.Organizations.haveMemberWithEmail(oid, inviteRequest.email);
                    if (isMemberDuplicate) {
                        throw new UserError(ErrorText.memberWithEmailAlreadyExists);
                    }

                    let invite = await Modules.Invites.repo.createOrganizationInvite(
                        oid,
                        uid,
                        inviteRequest.firstName || '',
                        inviteRequest.lastName || '',
                        inviteRequest.email,
                        inviteRequest.emailText || '',
                        inviteRequest.role,
                    );

                    await Emails.sendInviteEmail(oid, invite);
                }
                return 'ok';
            });
        }),
        alphaOrganizationCreatePublicInvite: withAccount<{ expirationDays?: number, organizationId?: string }>(async (args, uid, oid) => {
            return inTx(async () => {
                oid = args.organizationId ? IDs.Organization.parse(args.organizationId) : oid;
                let isOwner = await Repos.Organizations.isOwnerOfOrganization(oid, uid);

                if (!isOwner) {
                    throw new UserError(ErrorText.permissionOnlyOwner);
                }

                return await Modules.Invites.repo.createPublicOrganizationInvite(oid, uid);
            });
        }),
        alphaOrganizationDeletePublicInvite: withAccount<{ organizationId?: string }>(async (args, uid, oid) => {
            oid = args.organizationId ? IDs.Organization.parse(args.organizationId) : oid;
            return inTx(async () => {
                let isOwner = await Repos.Organizations.isOwnerOfOrganization(oid, uid);

                if (!isOwner) {
                    throw new UserError(ErrorText.permissionOnlyOwner);
                }

                await Modules.Invites.repo.deletePublicOrganizationInvite(oid, uid);
                return 'ok';
            });
        })
    }
};