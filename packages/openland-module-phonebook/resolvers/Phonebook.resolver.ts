import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { withUser } from '../../openland-module-api/Resolvers';
import { Modules } from '../../openland-modules/Modules';

export const Resolver: GQLResolver = {
    Mutation: {
        phonebookAdd: withUser(async (ctx, args, uid) => {
            await Modules.Phonebook.addRecords(ctx, uid, args.records);
            return true;
        })
    }
};
