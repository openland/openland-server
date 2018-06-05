import { DB } from '../tables';
import { Organization } from '../tables/Organization';
import { CallContext } from './CallContext';
import { withUser } from './utils/Resolvers';
import { normalizeNullableUserInput } from '../modules/Normalizer';
import { Repos } from '../repositories';
import { ImageRef } from '../repositories/Media';
import { IDs } from './utils/IDs';

export const Resolver = {
    MyAccount: {
        id: (src: Organization) => IDs.Organization.serialize(src.id!!),
        title: (src: Organization) => src.title
    },
    OrganizationAccount: {
        id: (src: Organization) => IDs.OrganizationAccount.serialize(src.id!!),
        title: (src: Organization) => src.title,
        photo: (src: Organization) => null
    },
    Query: {
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
            let isProfileCreated = !!(await DB.UserProfile.find({ where: { userId: context.uid } }));

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
        alphaSaveProfile: withUser<{ firstName: string, lastName?: string | null, photo?: ImageRef | null, phone?: number }>(async (args, uid) => {
            let lastNameNormalized = normalizeNullableUserInput(args.lastName);
            let firstNameNormalized = args.firstName.trim();
            if (firstNameNormalized.length === 0) {
                throw Error('First name can\'t be empty');
            }
            await Repos.Users.saveProfile(uid, firstNameNormalized, lastNameNormalized, args.photo, args.phone);
            return 'ok';
        })
    }
};