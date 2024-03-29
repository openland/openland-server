import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { Store } from '../../openland-module-db/FDB';
import { withUser } from '../../openland-module-users/User.resolver';

export const Resolver: GQLResolver = {
    User: {
        inContacts: withUser(async (ctx, src) => {
            if (!ctx.auth.uid) {
                return false;
            }
            let contact = await Store.Contact.findById(ctx, ctx.auth.uid, src.id);
            if (contact && contact.state === 'active') {
                return true;
            }
            return false;
        }, true),
    }
};