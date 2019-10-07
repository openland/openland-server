import { Store } from 'openland-module-db/FDB';
import { declareSearchIndexer } from 'openland-module-search/declareSearchIndexer';
import { Modules } from '../../openland-modules/Modules';
import { inTx } from '@openland/foundationdb';

export function organizationProfileIndexer() {
    declareSearchIndexer('organization-profile-index', 8, 'organization', Store.OrganizationIndexingQueue.updated.stream({ batchSize: 50 }))
        .withProperties({
            name: {
                type: 'text'
            },
            kind: {
                type: 'keyword'
            },
            createdAt: {
                type: 'date'
            },
            updatedAt: {
                type: 'date'
            },
            featured: {
                type: 'boolean'
            },
            listed: {
                type: 'boolean'
            },
            shortname: {
                type: 'text'
            },
            status: {
                type: 'text'
            },
            membersCount: {
                type: 'integer'
            }
        })
        .start(async (item, parent) => {
            return await inTx(parent, async (ctx) => {
                let org = (await Store.Organization.findById(ctx, item.id))!;
                let profile = (await (Store.OrganizationProfile.findById(ctx, item.id)))!;
                let editorial = (await Store.OrganizationEditorial.findById(ctx, item.id))!;
                let shortname = await Modules.Shortnames.findShortnameByOwner(ctx, 'org', item.id);
                let membersCount = await Modules.Orgs.organizationMembersCount(ctx, item.id);

                return {
                    id: item.id,
                    doc: {
                        name: profile.name,
                        kind: org.kind,
                        featured: editorial.featured,
                        listed: editorial.listed,
                        createdAt: item.metadata.createdAt,
                        updatedAt: item.metadata.updatedAt,
                        shortname: shortname ? shortname.shortname : undefined,
                        status: org.status,
                        membersCount
                    }
                };
            });
        });
}