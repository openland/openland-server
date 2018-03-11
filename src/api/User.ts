import { DB, User } from '../tables';
import { CallContext } from './CallContext';
import { IDs } from './utils/IDs';

export const Resolver = {
    User: {
        id: (src: User) => IDs.User.serialize(src.id!!),
        name: (src: User) => src.firstName + ' ' + src.lastName,
        firstName: (src: User) => src.firstName,
        lastName: (src: User) => src.lastName,
        picture: (src: User) => src.picture,
        email: (src: User) => src.email,
        isYou: (src: User, args: {}, context: CallContext) => src.id === context.uid
    },
    Query: {
        me: async function (_obj: any, _params: {}, context: CallContext) {
            if (context.uid == null) {
                return null;
            } else {
                return DB.User.findById(context.uid);
            }
        }
    }
};