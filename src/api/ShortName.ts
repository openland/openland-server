import { DB } from '../tables';
import { withAccount } from './utils/Resolvers';
import { UserError } from '../errors/UserError';
import { ErrorText } from '../errors/ErrorText';

function testShortName(name: string) {
    if (!/^\w*$/.test(name)) {
        throw new UserError('Invalid shortname');
    }

    if (name.length < 5) {
        throw new UserError('Too short');
    }
}

export const Resolvers = {
    ShortNameDestination: {
        __resolveType(src: any) {
            if (src instanceof (DB.User as any)) {
                return 'User';
            } else if (src instanceof (DB.Organization as any)) {
                return 'Organization';
            }

            throw new Error('Unknown shortname type');
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
            } else if (shortname.type === 'org') {
                return await DB.Organization.findById(shortname.ownerId);
            }

            return null;
        }),
    },
    Mutation: {
        alphaSetUserShortName: withAccount<{ shortname: string }>(async (args, uid, orgId) => {
            return await DB.tx(async (tx) => {
                testShortName(args.shortname);

                let existing = await DB.ShortName.findOne({ where: { name: args.shortname }, transaction: tx});

                if (existing && existing.ownerId !== uid) {
                    throw new UserError('Shortname already used');
                }

                await DB.ShortName.destroy({ where: { ownerId: uid }, transaction: tx});

                await DB.ShortName.create({
                    name: args.shortname,
                    ownerId: uid,
                    type: 'user'
                }, { transaction: tx });

                return 'ok';
            });
        }),
        alphaSetOrgShortName: withAccount<{ shortname: string, id: number }>(async (args, uid, orgId) => {
            return await DB.tx(async (tx) => {
                testShortName(args.shortname);

                let member = await DB.OrganizationMember.find({
                    where: {
                        orgId: args.id,
                        userId: uid,
                    }
                });
                if (member === null || !member.isOwner) {
                    throw new UserError(ErrorText.permissionOnlyOwner);
                }

                let existing = await DB.ShortName.findOne({ where: { name: args.shortname }, transaction: tx});

                if (existing && existing.ownerId !== args.id) {
                    throw new UserError('Shortname already used');
                }

                await DB.ShortName.destroy({ where: { ownerId: args.id }, transaction: tx});

                await DB.ShortName.create({
                    name: args.shortname,
                    ownerId: args.id,
                    type: 'org'
                }, { transaction: tx });

                return 'ok';
            });
        }),
    }
};