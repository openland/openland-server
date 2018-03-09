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