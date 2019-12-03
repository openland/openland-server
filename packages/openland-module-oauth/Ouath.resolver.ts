import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { withActivatedUser, withPermission } from '../openland-module-api/Resolvers';
import { Modules } from '../openland-modules/Modules';
import { AuthContext } from '../openland-module-auth/AuthContext';
import { OauthScope } from './OauthModule';
import { Store } from 'openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import { InvalidInputError } from '../openland-errors/InvalidInputError';
import { IDs } from 'openland-module-api/IDs';

export default {
    OauthApp: {
        clientId: withPermission('super-admin', (ctx, args, root) => root.clientId),
        clientSecret: withPermission('super-admin', (ctx, args, root) => root.clientSecret),
        owner: (root, args, ctx) => Store.UserProfile.findById(ctx, root.uid),
        scopes: withPermission('super-admin', (ctx, args, root) => root.allowedScopes),
        redirectUrls: withPermission('super-admin', (ctx, args, root) => root.allowedRedirectUrls),
        title: root => root.title,
        image: root => root.image,
        id: root => IDs.OauthApp.serialize(root.id),
    },
    OauthContext: {
        app: (root, args, ctx) => Store.OauthApplication.byClientId.find(ctx, root.clientId),
        code: root => root.code,
        redirectUrl: root => root.redirectUrl,
        state: root => root.state,
    },

    Query: {
        myOauthApps: withPermission('super-admin', async (ctx) => {
            let user = AuthContext.get(ctx);

            return Store.OauthApplication.user.findAll(ctx, user.uid!);
        }),
        oauthContext: withActivatedUser((parent, args, uid) => {
            return inTx(parent, async ctx => {
                let auth = await Store.OauthContext.fromCode.find(ctx, args.code);
                if (!auth) {
                    return null;
                }

                auth.uid = uid;
                await auth.flush(ctx);
                return auth;
            });
        }),
    },

    Mutation: {
        createOauthApp: withPermission('super-admin', async (ctx, args) => {
            let user = AuthContext.get(ctx);

            if (!args.input.title) {
                throw new InvalidInputError([{ key: 'input', message: 'Title is not defined' }]);
            }

            return await Modules.Oauth.createApp(
                ctx,
                user.uid!,
                args.input.title,
                args.input.scopes as (OauthScope[] | null),
                args.input.redirectUrls,
                args.input.image,
            );
        }),
        updateOauthApp: withPermission('super-admin', async (ctx, args) => {
            let id = IDs.OauthApp.parse(args.id);
            return await Modules.Oauth.updateApp(
                ctx,
                id,
                args.input.title,
                args.input.scopes as (OauthScope[] | null),
                args.input.redirectUrls,
                args.input.image,
            );
        }),
    },
} as GQLResolver;