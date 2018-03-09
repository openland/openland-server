import { DB, User } from '../tables';
import { CallContext } from './CallContext';
import { ID } from '../modules/ID';
import { withPermission } from './utils/Resolvers';

export let UserId = new ID('User');

export const Resolver = {
    User: {
        id: (src: User) => UserId.serialize(src.id!!),
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
        },
        users: withPermission<{ query: string }>('super-admin', async (args) => {
            return await DB.User.findAll({
                where: {
                    email: {
                        $like: args.query + '%'
                    }
                },
                limit: 10
            });
        })
    },
    Mutation: {
        superAdminAdd: withPermission<{ userId: string }>('super-admin', async (args) => {
            let uid = UserId.parse(args.userId);
            if (await DB.SuperAdmin.findOne({
                where: {
                    userId: uid
                }
            }) !== null) {
                return 'ok';
            }
            await DB.SuperAdmin.create({
                userId: uid
            });
            return 'ok';
        }),
        superAdminRemove: withPermission<{ userId: string }>('super-admin', async (args) => {
            let uid = UserId.parse(args.userId);
            if (await DB.SuperAdmin.count() <= 1) {
                throw Error('You can\'t remove last Super Admin from the system');
            }
            await DB.SuperAdmin.destroy({ where: { userId: uid } });
            return 'ok';
        })
    }
};