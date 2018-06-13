import { DB } from '../tables';
import { Organization } from '../tables/Organization';
import { CallContext } from './utils/CallContext';
import { withUser, withAny } from './utils/Resolvers';
import { normalizeNullableUserInput } from '../modules/Normalizer';
import { Repos } from '../repositories';
import { ImageRef } from '../repositories/Media';
import { IDs } from './utils/IDs';
import { withAccount } from './utils/Resolvers';
import { OrganizationInvite } from '../tables/OrganizationInvite';
import { randomKey } from '../utils/random';
import { buildBaseImageUrl } from '../repositories/Media';
import { NotFoundError } from '../errors/NotFoundError';
import { ErrorText } from '../errors/ErrorText';
import { UserError } from '../errors/UserError';

export const Resolver = {
    MyAccount: {
        id: (src: Organization) => IDs.Organization.serialize(src.id!!),
        title: (src: Organization) => src.name,
        name: (src: Organization) => src.name
    },
    OrganizationAccount: {
        id: (src: Organization) => IDs.OrganizationAccount.serialize(src.id!!),
        title: (src: Organization) => src.name,
        name: (src: Organization) => src.name,
        logo: (src: Organization) => src.photo ? buildBaseImageUrl(src.photo) : null,
        photo: (src: Organization) => src.photo ? buildBaseImageUrl(src.photo) : null,
        photoRef: (src: Organization) => src.photo,
        website: (src: Organization) => src.website,
    },
    Invite: {
        id: (src: OrganizationInvite) => IDs.Invite.serialize(src.id),
        key: (src: OrganizationInvite) => src.uuid
    },
    Query: {
        alphaInvites: withAccount(async (args, uid, oid) => {
            return await DB.OrganizationInvite.findAll({ where: { orgId: oid } });
        }),
        alphaInviteInfo: withAny<{ key: string }>(async (args, context: CallContext) => {
            let invite = await DB.OrganizationInvite.find({ where: { uuid: args.key } });
            if (!invite) {
                return null;
            }
            let org = await DB.Organization.findById(invite.orgId);
            if (!org) {
                return null;
            }
            let joined = false;
            if (context.uid && context.oid) {
                joined = (await DB.OrganizationMember.find({ where: { userId: context.uid, orgId: org.id } })) !== null;
            }
            return {
                id: IDs.InviteInfo.serialize(invite.id),
                key: args.key,
                orgId: IDs.OrganizationAccount.serialize(org.id!!),
                title: org.name,
                photo: org.photo ? buildBaseImageUrl(org.photo) : null,
                photoRef: org.photo,
                joined: joined,
            };
        }),
        alphaProfilePrefill: async function (_: any, args: {}, context: CallContext) {
            if (!context.uid) {
                return {};
            }
            let prefill = await DB.UserProfilePrefill.find({ where: { userId: context.uid } });
            if (prefill) {
                return {
                    firstName: prefill.firstName,
                    lastName: prefill.lastName,
                    picture: prefill.picture
                };
            } else {
                return {};
            }
        },
        profilePrefill: async function (_: any, args: {}, context: CallContext) {
            if (!context.uid) {
                return {};
            }
            let prefill = await DB.UserProfilePrefill.find({ where: { userId: context.uid } });
            if (prefill) {
                return {
                    firstName: prefill.firstName,
                    lastName: prefill.lastName,
                    picture: prefill.picture
                };
            } else {
                return {};
            }
        },
        alphaAvailableOrganizationAccounts: withUser(async (args, uid) => {
            let allOrgs = await DB.OrganizationMember.findAll({
                where: {
                    userId: uid
                }
            });
            return await DB.Organization.findAll({
                where: {
                    id: {
                        $in: allOrgs.map((v) => v.orgId)
                    }
                }
            });
        }),
        myProfile: async function (_: any, args: {}, context: CallContext) {

            // If there are no user in the context
            if (!context.uid) {
                return {
                    isLoggedIn: false,
                    isProfileCreated: false,
                    isAccountExists: false,
                    isAccountPicked: false,
                    isAccountActivated: false,
                    isCompleted: false,
                    isBlocked: false
                };
            }

            // User unknown?! Just softly ignore errors
            let res = await DB.User.findById(context.uid);
            if (res === null) {
                return {
                    isLoggedIn: false,
                    isProfileCreated: false,
                    isAccountExists: false,
                    isAccountPicked: false,
                    isAccountActivated: false,
                    isCompleted: false,
                    isBlocked: false
                };
            }

            // State 0: Is Logged In
            let isLoggedIn = true; // Checked in previous steps

            // Stage 1: Create Profile
            let profile = (await DB.UserProfile.find({ where: { userId: context.uid } }));
            let isProfileCreated = !!profile;

            // Stage 2: Pick organization or create a new one (if there are no exists)
            let organization = !!context.oid ? await DB.Organization.findById(context.oid) : null;
            let isOrganizationPicked = organization !== null;
            let isOrganizationExists = (await Repos.Users.fetchUserAccounts(context.uid)).length > 0;

            // Stage 3: Organization Status
            let isOrganizationActivated = isOrganizationPicked && organization!!.status !== 'PENDING';
            let isOrganizationSuspended = isOrganizationPicked ? organization!!.status === 'SUSPENDED' : false;

            let queryResult = {
                isLoggedIn: isLoggedIn,
                isProfileCreated: isProfileCreated,
                isAccountExists: isOrganizationExists,
                isAccountPicked: isOrganizationPicked,
                isAccountActivated: isOrganizationActivated,
                isCompleted: isProfileCreated && isOrganizationExists && isOrganizationPicked && isOrganizationActivated,
                isBlocked: isOrganizationSuspended
            };

            console.warn(queryResult);
            return queryResult;
        },
        myAccount: async function (_: any, args: {}, context: CallContext) {
            if (!context.uid) {
                return null;
            }
            if (!context.oid) {
                return null;
            }
            return DB.Organization.findById(context.oid);
        }
    },
    Mutation: {
        alphaJoinInvite: withUser<{ key: string }>(async (args, uid) => {
            return await DB.tx(async (tx) => {
                let invite = await DB.OrganizationInvite.find({ where: { uuid: args.key }, transaction: tx });
                if (!invite) {
                    throw new NotFoundError(ErrorText.unableToFindInvite);
                }
                let existing = await DB.OrganizationMember.find({ where: { userId: uid, orgId: invite.orgId }, transaction: tx });
                if (existing) {
                    return IDs.OrganizationAccount.serialize(invite.orgId);
                }
                await DB.OrganizationMember.create({ userId: uid, orgId: invite.orgId, isOwner: false }, { transaction: tx });
                return IDs.OrganizationAccount.serialize(invite.orgId);
            });
        }),
        alphaSaveProfile: withUser<{ firstName: string, lastName?: string | null, photo?: ImageRef | null, phone?: string }>(async (args, uid) => {
            let lastNameNormalized = normalizeNullableUserInput(args.lastName);
            let firstNameNormalized = args.firstName.trim();
            if (firstNameNormalized.length === 0) {
                throw new UserError(ErrorText.firstNameEmpty);
            }
            await Repos.Users.saveProfile(uid, firstNameNormalized, lastNameNormalized, args.photo, args.phone);
            return 'ok';
        }),
        alphaCreateInvite: withAccount(async (args, uid, oid) => {
            return await DB.OrganizationInvite.create({
                uuid: randomKey(),
                orgId: oid
            });
        }),
        alphaDeleteInvite: withAccount<{ id: string }>(async (args, uid, oid) => {
            await DB.OrganizationInvite.destroy({
                where: {
                    orgId: oid,
                    id: IDs.Invite.parse(args.id)
                }
            });
            return 'ok';
        }),

    }
};