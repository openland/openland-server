import { DB } from '../tables';
import { Organization } from '../tables/Organization';
import { ID } from '../modules/ID';
import { CallContext } from './CallContext';

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
            let res = await DB.User.findById(context.uid, { include: [{ model: DB.Organization, as: 'organization' }] });
            if (res === null) {
                return {
                    isLoggedIn: false,
                    isProfileCreated: false,
                    isAccountActivated: false,
                    isCompleted: false,
                    isBlocked: false
                };
            }
            return {
                isLoggedIn: true,
                isProfileCreated: true,
                isAccountActivated: res.organization !== null && res.organization!!.status !== 'PENDING',
                isCompleted: res.organization !== null && res.organization!!.status !== 'PENDING',
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
    }
};