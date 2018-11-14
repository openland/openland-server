import { FeatureFlag } from 'openland-module-db/schema';
import { withPermission } from 'openland-module-api/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { FDB } from 'openland-module-db/FDB';
import { IDs } from 'openland-module-api/IDs';

export default {
    FeatureFlag: {
        id: (src: FeatureFlag) => src.key /* TODO: FIXME */,
        title: (src: FeatureFlag) => src.title,
        key: (src: FeatureFlag) => src.key
    },
    Query: {
        featureFlags: withPermission(['super-admin', 'software-developer'], () => {
            return Modules.Features.repo.findAllFeatures();
        }),
    },
    Mutation: {
        featureFlagAdd: withPermission<{ key: string, title: string }>(['super-admin', 'software-developer'], async (ctx, args) => {
            return Modules.Features.repo.createFeatureFlag(args.key, args.title);
        }),
        superAccountFeatureAdd: withPermission<{ id: string, featureId: string }>(['super-admin', 'software-developer'], async (ctx, args) => {
            let org = await FDB.Organization.findById(IDs.SuperAccount.parse(args.id));
            if (!org) {
                throw Error('Unable to find organization');
            }
            await Modules.Features.repo.enableFeatureForOrganization(org.id, args.featureId);
            return org;
        }),
        superAccountFeatureRemove: withPermission<{ id: string, featureId: string }>(['super-admin', 'software-developer'], async (ctx, args) => {
            let org = await FDB.Organization.findById(IDs.SuperAccount.parse(args.id));
            if (!org) {
                throw Error('Unable to find organization');
            }
            await Modules.Features.repo.disableFeatureForOrganization(org.id, args.featureId);
            return org;
        }),
    }
};