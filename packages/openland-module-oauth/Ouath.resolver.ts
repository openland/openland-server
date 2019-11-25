import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { withActivatedUser, withPermission } from '../openland-module-api/Resolvers';
import { Modules } from '../openland-modules/Modules';
import { AuthContext } from '../openland-module-auth/AuthContext';
import { OauthScope } from './OauthModule';
import { Store } from 'openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';

export default {
    OauthApp: {
        clientId: root => root.clientId,
        clientSecret: root => root.clientSecret,
        owner: (root, args, ctx) => Store.UserProfile.findById(ctx, root.uid),
        scopes: root => root.allowedScopes,
        title: root => root.title,
    },
    OauthContext: {
        app: (root, args, ctx) => Store.OauthApplication.findById(ctx, root.clientId),
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

            return await Modules.Oauth.createApp(ctx, user.uid!, args.title, args.scopes as (OauthScope[] | null));
        }),
    },
} as GQLResolver;