import { Repos } from 'openland-server/repositories';
import { withPermission } from 'openland-server/api/utils/Resolvers';
import { UserError } from 'openland-server/errors/UserError';
import { CallContext } from 'openland-server/api/utils/CallContext';

export default {
    Query: {
        permissions: async function (_: any, _params: {}, context: CallContext) {
            return {
                roles: Repos.Permissions.resolvePermissions({ uid: context.uid, oid: context.oid })
            };
        },
        users: withPermission<{ query: string }>('super-admin', async (args) => {
            // let sequelize = DB.connection;
            // let usersProfiles = await DB.UserProfile.findAll({
            //     where:
            //         [
            //             sequelize.or(
            //                 sequelize.where(sequelize.fn('concat', sequelize.col('firstName'), ' ', sequelize.col('lastName')), {
            //                     $ilike: '%' + args.query.toLowerCase() + '%'
            //                 }),
            //                 {
            //                     firstName: {
            //                         $ilike: args.query.toLowerCase() + '%'
            //                     }
            //                 },
            //                 {
            //                     lastName: {
            //                         $ilike: args.query.toLowerCase() + '%'
            //                     }
            //                 },
            //                 {
            //                     email: {
            //                         $ilike: '%' + args.query.toLowerCase() + '%'
            //                     }
            //                 }
            //             ),
            //         ],
            // });
            // let userIds = usersProfiles.map(u => u.userId!!);
            // return await DB.User.findAll({
            //     where: {
            //         id: {
            //             $in: userIds
            //         }
            //     },
            //     limit: 10
            // });
            throw new UserError('Not supported yet');
        }),
    },
};