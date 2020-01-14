import { Modules } from 'openland-modules/Modules';
import { Store } from 'openland-module-db/FDB';
import { withAccount } from 'openland-module-api/Resolvers';
import { IDs } from 'openland-module-api/IDs';
import { GQLResolver } from 'openland-module-api/schema/SchemaSpec';

export default {
    CreditCard: {
        id: (src) => IDs.CreditCard.serialize(src.pmid),
        brand: (src) => src.brand,
        last4: (src) => src.last4,
        expMonth: (src) => src.exp_month,
        expYear: (src) => src.exp_year
    },
    CardSetupIntent: {
        id: (src) => IDs.CreditCardSetupIntent.serialize(src.id),
        clientSecret: (src) => src.client_secret
    },
    Query: {
        myCards: withAccount(async (ctx, args, uid) => {
            let res = await Store.UserStripeCard.users.findAll(ctx, uid);
            res.sort((a, b) => a.metadata.createdAt - b.metadata.createdAt);
            return res;
        })
    },
    Mutation: {
        cardCreateSetupIntent: withAccount(async (ctx, args, uid) => {
            return await Modules.Billing.createSetupIntent(ctx, uid, args.retryKey);
        }),
        cardCommitSetupIntent: withAccount(async (ctx, args, uid) => {
            return await Modules.Billing.registerCard(ctx, uid, args.pmid);
        })
    }
} as GQLResolver;