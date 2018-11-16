import { withPermission } from 'openland-module-api/Resolvers';
import { inTx } from 'foundation-orm/inTx';
import { FDB } from 'openland-module-db/FDB';
import { UserError } from 'openland-errors/UserError';
import { ErrorText } from 'openland-errors/ErrorText';
import { IDs } from 'openland-module-api/IDs';
import { Modules } from 'openland-modules/Modules';
import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';

export default {
    Mutation: {
        alphaAlterPublished: withPermission(['super-admin', 'editor'], async (parent, args) => {
            return await inTx(parent, async (ctx) => {
                let org = await FDB.Organization.findById(ctx, IDs.Organization.parse(args.id));
                if (!org) {
                    throw new UserError(ErrorText.unableToFindOrganization);
                }
                let editorial = await FDB.OrganizationEditorial.findById(ctx, org.id);
                editorial!.listed = args.published;

                // Schedule for indexing
                await Modules.Orgs.markForUndexing(ctx, org.id);

                return org;
            });
        }),
    }
} as GQLResolver;