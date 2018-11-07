import { withUser, withPermission, withAccount } from 'openland-server/api/utils/Resolvers';
import { ImageRef } from 'openland-module-media/ImageRef';
import { Repos } from 'openland-server/repositories';
import { inTx } from 'foundation-orm/inTx';
import { FDB } from 'openland-module-db/FDB';
import { IDs, IdsFactory } from 'openland-server/api/utils/IDs';
import { UserError } from 'openland-server/errors/UserError';
import { ErrorText } from 'openland-server/errors/ErrorText';
import { validate, stringNotEmpty, defined, emailValidator } from 'openland-utils/NewInputValidator';
import { Sanitizer } from 'openland-utils/Sanitizer';
import { Modules } from 'openland-modules/Modules';
import { AccessDeniedError } from 'openland-server/errors/AccessDeniedError';
import { NotFoundError } from 'openland-server/errors/NotFoundError';
import { Emails } from 'openland-module-email/Emails';

export default {
    Mutation: {
        createOrganization: withUser<{
            input: {
                name: string,
                website?: string | null
                personal: boolean
                photoRef?: ImageRef | null
                about?: string
                isCommunity?: boolean
            }
        }>(async (args, uid) => {
            return await Repos.Organizations.createOrganization(uid, args.input);
        }),
        alphaAlterPublished: withPermission<{ id: string, published: boolean }>(['super-admin', 'editor'], async (args) => {
            return await inTx(async () => {
                let org = await FDB.Organization.findById(IDs.Organization.parse(args.id));
                if (!org) {
                    throw new UserError(ErrorText.unableToFindOrganization);
                }
                let editorial = await FDB.OrganizationEditorial.findById(org.id);
                editorial!.listed = args.published;
                return org;
            });
        }),
        updateOrganizationProfile: withAccount<{
            input: {
                name?: string | null,
                photoRef?: ImageRef | null,

                website?: string | null
                websiteTitle?: string | null
                about?: string | null
                twitter?: string | null
                facebook?: string | null
                linkedin?: string | null
                location?: string | null

                contacts?: {
                    name: string
                    photoRef?: ImageRef | null
                    position?: string | null
                    email?: string | null
                    phone?: string | null
                    link?: string | null
                }[] | null

                alphaPublished?: boolean | null;
                alphaEditorial?: boolean | null;
                alphaFeatured?: boolean | null;

                alphaOrganizationType?: string[] | null
            },
            id?: string;
        }>(async (args, uid, oid) => {

            let orgId = oid;
            if (args.id) {
                let role = await Repos.Permissions.superRole(uid);
                if (!(role === 'super-admin' || role === 'editor')) {
                    throw new UserError(ErrorText.permissionOnlyOwner);
                }
                orgId = IDs.Organization.parse(args.id);
            } else {
                let member = await FDB.OrganizationMember.findById(oid, uid);
                if (member === null || member.status !== 'joined' || member.role !== 'admin') {
                    throw new UserError(ErrorText.permissionOnlyOwner);
                }
            }

            return await inTx(async () => {
                let existing = await FDB.Organization.findById(orgId);
                if (!existing) {
                    throw new UserError(ErrorText.unableToFindOrganization);
                }

                let profile = (await FDB.OrganizationProfile.findById(orgId))!;

                if (args.input.name !== undefined) {
                    await validate(
                        stringNotEmpty('Name can\'t be empty!'),
                        args.input.name,
                        'input.name'
                    );
                    profile.name = Sanitizer.sanitizeString(args.input.name)!;
                }
                if (args.input.website !== undefined) {
                    profile.website = Sanitizer.sanitizeString(args.input.website);
                }
                if (args.input.photoRef !== undefined) {
                    if (args.input.photoRef !== null) {
                        await Modules.Media.saveFile(args.input.photoRef.uuid);
                    }
                    profile.photo = Sanitizer.sanitizeImageRef(args.input.photoRef);
                }

                if (args.input.twitter !== undefined) {
                    profile.twitter = Sanitizer.sanitizeString(args.input.twitter);
                }
                if (args.input.facebook !== undefined) {
                    profile.facebook = Sanitizer.sanitizeString(args.input.facebook);
                }
                if (args.input.linkedin !== undefined) {
                    profile.linkedin = Sanitizer.sanitizeString(args.input.linkedin);
                }
                if (args.input.about !== undefined) {
                    profile.about = Sanitizer.sanitizeString(args.input.about);
                }

                let editorial = (await FDB.OrganizationEditorial.findById(oid))!;

                if (args.input.alphaPublished !== undefined) {
                    editorial.listed = Sanitizer.sanitizeAny(args.input.alphaPublished) ? true : false;
                }

                if (args.input.alphaEditorial !== undefined) {
                    existing.editorial = Sanitizer.sanitizeAny(args.input.alphaEditorial) ? true : false;
                }

                if (args.input.alphaFeatured !== undefined) {
                    editorial.featured = Sanitizer.sanitizeAny(args.input.alphaFeatured) || false;
                }

                return existing;
            });
        }),

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
                    user.primaryOrganization = (await Repos.Users.fetchUserAccounts(uid))[0];
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