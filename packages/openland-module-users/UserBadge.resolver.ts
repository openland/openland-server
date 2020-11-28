import { IDs } from 'openland-module-api/IDs';
import { withUser, withPermission } from 'openland-module-api/Resolvers';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { UserError } from '../openland-errors/UserError';

export const Resolver: GQLResolver = {
    UserBadge: {
        id: (src) => IDs.UserBadge.serialize(src.id),
        name: (src) => src.name,
        verified: (src) => !!src.verifiedBy,
    },
    Query: {
        badgeInRoom: withUser(async (ctx, args, uid) => {
            return null;
        }),

        superBadgeInRoom: withPermission('super-admin', async (ctx, args) => {
            return null;
        }),
    },
    Mutation: {
        badgeCreate: withUser(async (ctx, args, uid) => {
            throw new UserError('This method is not supported');
        }),
        badgeCreateToRoom: withUser(async (ctx, args, uid) => {
            throw new UserError('This method is not supported');
        }),
        badgeSetToRoom: withUser(async (ctx, args, uid) => {
            throw new UserError('This method is not supported');
        }),
        badgeUnsetToRoom: withUser(async (ctx, args, uid) => {
            throw new UserError('This method is not supported');
        }),
        badgeDelete: withUser(async (ctx, args, uid) => {
            throw new UserError('This method is not supported');
        }),
        badgeSetPrimary: withUser(async (ctx, args, uid) => {
            throw new UserError('This method is not supported');
        }),
        badgeUnsetPrimary: withUser(async (ctx, args, uid) => {
            throw new UserError('This method is not supported');
        }),

        // super-admin methods
        superBadgeCreate: withPermission('super-admin', async (ctx, args) => {
            throw new UserError('This method is not supported');
        }),
        superBadgeCreateToRoom: withPermission('super-admin', async (ctx, args) => {
            throw new UserError('This method is not supported');
        }),
        superBadgeSetToRoom: withPermission('super-admin', async (ctx, args) => {
            throw new UserError('This method is not supported');
        }),
        superBadgeUnsetToRoom: withPermission('super-admin', async (ctx, args) => {
            throw new UserError('This method is not supported');
        }),
        superBadgeDelete: withPermission('super-admin', async (ctx, args) => {
            throw new UserError('This method is not supported');
        }),
        superBadgeVerify: withPermission('super-admin', async (ctx, args) => {
            throw new UserError('This method is not supported');
        }),
        superBadgeUnverify: withPermission('super-admin', async (ctx, args) => {
            throw new UserError('This method is not supported');
        }),
    }
};
