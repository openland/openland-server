import { withAccount } from 'openland-module-api/Resolvers';
import { inTx } from '@openland/foundationdb';
import { IDs } from 'openland-module-api/IDs';
import { UserError } from 'openland-errors/UserError';
import { ErrorText } from 'openland-errors/ErrorText';
import { validate, defined, emailValidator } from 'openland-utils/NewInputValidator';
import { Modules } from 'openland-modules/Modules';
import { AccessDeniedError } from 'openland-errors/AccessDeniedError';
import { resolveOrganizationJoinedMembers, resolveRoleInOrganization } from './utils/resolveOrganizationJoinedMembers';
import { GQL, GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { Store } from 'openland-module-db/FDB';
import OrganizationMemberRoleValues = GQL.OrganizationMemberRoleValues;

export const Resolver: GQLResolver = {
    OrganizationMember: {
        __resolveType(src: any) {
            return src._type;
        }
    },
    JoinedOrganizationMember: {
        user: src => src.uid,
        role: async (src, _, ctx) => {
            let role: OrganizationMemberRoleValues;
            let org = (await Store.Organization.findById(ctx, src.oid))!;
            if (org.ownerId === src.uid) {
                role = 'OWNER';
            } else if (src.role === 'admin') {
                role = 'ADMIN';
            } else {
                role = 'MEMBER';
            }
            return role;
        },
        joinedAt: src => src.metadata.createdAt.toString(10)
    },
    Query: {
        alphaOrganizationMembers: withAccount(async (ctx, args, uid, orgId) => {
            let targetOrgId = IDs.Organization.parse(args.orgId);

            let isMember = await Modules.Orgs.isUserMember(ctx, uid, targetOrgId);

            if (!isMember) {
                throw new AccessDeniedError(ErrorText.permissionDenied);
            }

            let result: any[] = [];

            result.push(...await resolveOrganizationJoinedMembers(ctx, { first: args.first, afterMemberId: args.after ? IDs.User.parse(args.after) : null }, targetOrgId));

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
            return (await Store.Organization.findById(ctx, IDs.Organization.parse(args.organizationId)))!;
        }),
        betaOrganizationMemberAdd: withAccount(async (ctx, args, uid) => {
            return await inTx(ctx, async (c) => {
                let toAdd = [...args.userIds || [], ...args.userId ? [args.userId] : []];
                for (let u of toAdd) {
                    await Modules.Orgs.addUserToOrganization(c, IDs.User.parse(u), IDs.Organization.parse(args.organizationId), uid);
                }
                return (await Store.Organization.findById(ctx, IDs.Organization.parse(args.organizationId)))!;
            });
        }),
        alphaOrganizationMemberAdd: withAccount(async (ctx, args, uid) => {
            let oid = IDs.Organization.parse(args.organizationId);

            return await inTx(ctx, async (c) => {
                let toAdd = [...args.userIds || [], ...args.userId ? [args.userId] : []];
                let res = [];
                for (let u of toAdd) {
                    let uidToAdd = IDs.User.parse(u);

                    await Modules.Orgs.addUserToOrganization(c, uidToAdd, oid, uid);

                    let member = await Store.OrganizationMember.findById(c, oid, uidToAdd);

                    if (member && member.status === 'joined') {
                        let user = (await Store.User.findById(ctx, member.uid))!;

                        res.push({
                            _type: 'OrganizationJoinedMember',
                            user: user,
                            joinedAt: member.metadata.createdAt,
                            email: user.email,
                            showInContacts: false,
                            role: await resolveRoleInOrganization(ctx, oid, member),
                        });
                    }
                }
                return res;
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
            await Modules.Orgs.updateMemberRole(ctx, memberId, oid, args.newRole === 'ADMIN' ? 'admin' : 'member', uid);
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
};
