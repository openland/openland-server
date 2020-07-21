import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { withUser } from '../../openland-module-api/Resolvers';
import { Modules } from '../../openland-modules/Modules';
import { Store } from '../../openland-module-db/FDB';

export const Resolver: GQLResolver = {
    Query: {
        phonebookWasExported: withUser(async (ctx, args, uid) => {
            return await Store.PhonebookUserImportedContacts.get(ctx, uid);
        })
    },
    Mutation: {
        phonebookAdd: withUser(async (ctx, args, uid) => {
            await Modules.Phonebook.addRecords(ctx, uid, args.records);
            return true;
        })
    }
};
