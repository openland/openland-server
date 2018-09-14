import { DB } from '../tables';
import { withAccount } from './utils/Resolvers';
import { UserError } from '../errors/UserError';

export const Resolvers = {
    ShortNameDestination: {
        __resolveType(src: any) {
            return 'User';
        }
    },

    Query: {
        alphaResolveShortName: withAccount<{ shortname: string }>(async (args, uid, orgId) => {
            let shortname = await DB.ShortName.findOne({
                where: {
                    name: args.shortname
                }
            });

            if (!shortname) {
                return null;
            }

            if (shortname.type === 'user') {
                return await DB.User.findById(shortname.ownerId);
            }

            return null;
        }),
    },
    Mutation: {
        alphaSetUserShortName: withAccount<{ shortname: string }>(async (args, uid, orgId) => {
            return await DB.tx(async (tx) => {
                if (!/^\w*$/.test(args.shortname)) {
                    throw new UserError('Invalid shortname');
                }

                if (args.shortname.length < 5) {
                    throw new UserError('Too short');
                }

                let existing = await DB.ShortName.findOne({ where: { name: args.shortname }, transaction: tx});

                if (existing && existing.ownerId === uid) {
                    await existing.destroy();
                } else if (existing) {
                    throw new UserError('Shortname already used');
                }

                await DB.ShortName.create({
                    name: args.shortname,
                    ownerId: uid,
                    type: 'user'
                }, { transaction: tx });

                return 'ok';
            });
        }),
    }
};