import { Store } from './../openland-module-db/FDB';
import { FeatureFlag } from './../openland-module-db/store';
import { withPermission } from 'openland-module-api/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { IDs } from 'openland-module-api/IDs';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';

export const Resolver: GQLResolver = {
    FeatureFlag: {
        id: (src: FeatureFlag) => src.key /* TODO: FIXME */,
        title: (src: FeatureFlag) => src.title,
        key: (src: FeatureFlag) => src.key
    },
    Query: {
        featureFlags: withPermission(['super-admin', 'software-developer'], (ctx) => {
            return Modules.Features.repo.findAllFeatures(ctx);
        }),
    },
    Mutation: {
        featureFlagAdd: withPermission(['super-admin', 'software-developer'], async (ctx, args) => {
            return Modules.Features.repo.createFeatureFlag(ctx, args.key, args.title);
        }),
        superAccountFeatureAdd: withPermission(['super-admin', 'software-developer'], async (ctx, args) => {
            let org = await Store.Organization.findById(ctx, IDs.SuperAccount.parse(args.id));
            if (!org) {
                throw Error('Unable to find organization');
            }
            await Modules.Features.repo.enableFeatureForOrganization(ctx, org.id, args.featureId);
            return org;
        }),
        superAccountFeatureRemove: withPermission(['super-admin', 'software-developer'], async (ctx, args) => {
            let org = await Store.Organization.findById(ctx, IDs.SuperAccount.parse(args.id));
            if (!org) {
                throw Error('Unable to find organization');
            }
            await Modules.Features.repo.disableFeatureForOrganization(ctx, org.id, args.featureId);
            return org;
        }),
    }
};
