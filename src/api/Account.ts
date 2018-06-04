import { DB } from '../tables';
import { Organization } from '../tables/Organization';
import { ID } from '../modules/ID';
import { CallContext } from './CallContext';
import { withUser } from './utils/Resolvers';
import { normalizeNullableUserInput } from '../modules/Normalizer';
import { Repos } from '../repositories';
import { AvatarUpload } from '../repositories/UserRepository';

const OrgId = new ID('Organization');

export const Resolver = {
    MyAccount: {
        id: (src: Organization) => OrgId.serialize(src.id!!),
        title: (src: Organization) => src.title
    },
    Query: {
        myProfile: async function (_: any, args: {}, context: CallContext) {
            if (!context.uid) {
                return {
                    isLoggedIn: false,
                    isProfileCreated: false,
                    isAccountActivated: false,
                    isCompleted: false,
                    isBlocked: false
                };
            }
            let profile = !!(await DB.UserProfile.find({ where: { userId: context.uid } }));
            let res = await DB.User.findById(context.uid, { include: [{ model: DB.Organization, as: 'organization' }] });
            if (res === null) {
                return {
                    isLoggedIn: false,
                    isProfileCreated: profile,
                    isAccountActivated: false,
                    isCompleted: false,
                    isBlocked: false
                };
            }
            return {
                isLoggedIn: true,
                isProfileCreated: profile,
                isAccountActivated: (res.organization !== null && res.organization!!.status !== 'PENDING'),
                isCompleted: (res.organization !== null && res.organization!!.status !== 'PENDING') && profile,
                isBlocked: res.organization !== null ? res.organization!!.status === 'SUSPENDED' : false
            };
        },
        myAccount: async function (_: any, args: {}, context: CallContext) {
            if (!context.uid) {
                return null;
            }
            let res = await DB.User.findById(context.uid, { include: [{ model: DB.Organization, as: 'organization' }] });
            if (res === null) {
                throw Error('Access denied');
            }
            return res.organization;
        }
    },
    Mutation: {
        alphaSaveProfile: withUser<{ firstName: string, lastName?: string | null, photo?: AvatarUpload | null }>(async (args, uid) => {
            let lastNameNormalized = normalizeNullableUserInput(args.lastName);
            let firstNameNormalized = args.firstName.trim();
            if (firstNameNormalized.length === 0) {
                throw Error('First name can\'t be empty');
            }
            await Repos.Users.saveProfile(uid, firstNameNormalized, lastNameNormalized, args.photo !== undefined ? args.photo : null);
            return 'ok';
        })
    }
};