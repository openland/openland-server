import { withPermission } from 'openland-module-api/Resolvers';
import { inTx } from 'foundation-orm/inTx';
import { FDB } from 'openland-module-db/FDB';
import { UserError } from 'openland-errors/UserError';
import { ErrorText } from 'openland-errors/ErrorText';
import { IDs } from 'openland-module-api/IDs';
import { Modules } from 'openland-modules/Modules';

export default {
    Mutation: {
        alphaAlterPublished: withPermission<{ id: string, published: boolean }>(['super-admin', 'editor'], async (args) => {
            return await inTx(async () => {
                let org = await FDB.Organization.findById(IDs.Organization.parse(args.id));
                if (!org) {
                    throw new UserError(ErrorText.unableToFindOrganization);
                }
                let editorial = await FDB.OrganizationEditorial.findById(org.id);
                editorial!.listed = args.published;

                // Schedule for indexing
                await Modules.Orgs.markForUndexing(org.id);
                
                return org;
            });
        }),
    }
};