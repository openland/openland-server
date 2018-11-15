import { FDB } from 'openland-module-db/FDB';
import { declareSearchIndexer } from 'openland-module-search/declareSearchIndexer';
import { createEmptyContext } from 'openland-utils/Context';

export function organizationProfileIndexer() {
    declareSearchIndexer('organization-profile-index', 6, 'organization', FDB.OrganizationIndexingQueue.createUpdatedStream(createEmptyContext(), 50))
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
            }
        })
        .start(async (item) => {
            let org = (await FDB.Organization.findById(createEmptyContext(), item.id))!;
            let profile = (await (FDB.OrganizationProfile.findById(createEmptyContext(), item.id)))!;
            let editorial = (await FDB.OrganizationEditorial.findById(createEmptyContext(), item.id))!;
            return {
                id: item.id,
                doc: {
                    name: profile.name,
                    kind: org.kind,
                    featured: editorial.featured,
                    listed: editorial.listed,
                    createdAt: item.createdAt,
                    updatedAt: item.updatedAt,
                }
            };
        });
}