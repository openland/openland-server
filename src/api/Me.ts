import { DB } from '../tables';
import { CallContext } from './CallContext';

export const Schema = `
    type User {
        id: ID!
        name: String!
        firstName: String!
        lastName: String!
        picture: String!
    }
    extend type Query {
        me: User
    }
`;

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