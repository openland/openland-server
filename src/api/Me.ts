import { DB } from '../tables';
import { CallContext } from './CallContext';

export const Resolver = {
    Query: {
        me: async function (_obj: any, _params: {}, context: CallContext) {
            if (context.uid == null) {
                return null;
            } else {
                let res = await DB.User.findById(context.uid)!!;
                return {
                    id: res!!.id,
                    name: res!!.firstName + ' ' + res!!.lastName,
                    firstName: res!!.firstName,
                    lastName: res!!.lastName,
                    picture: res!!.picture
                };
            }
        }
    }
};