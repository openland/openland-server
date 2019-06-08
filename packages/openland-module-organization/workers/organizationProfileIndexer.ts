import { FDB } from 'openland-module-db/FDB';
import { declareSearchIndexer } from 'openland-module-search/declareSearchIndexer';
import { Modules } from '../../openland-modules/Modules';
import { EmptyContext } from '@openland/context';
import { inTx } from 'foundation-orm/inTx';

export function organizationProfileIndexer() {
    declareSearchIndexer('organization-profile-index', 8, 'organization', FDB.OrganizationIndexingQueue.createUpdatedStream(50))
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
        .start(async (item) => {
            return await inTx(EmptyContext, async (ctx) => {
                let org = (await FDB.Organization.findById(ctx, item.id))!;
                let profile = (await (FDB.OrganizationProfile.findById(ctx, item.id)))!;
                let editorial = (await FDB.OrganizationEditorial.findById(ctx, item.id))!;
                let shortname = await Modules.Shortnames.findOrganizationShortname(ctx, item.id);
                let membersCount = await Modules.Orgs.organizationMembersCount(ctx, item.id);

                return {
                    id: item.id,
                    doc: {
                        name: profile.name,
                        kind: org.kind,
                        featured: editorial.featured,
                        listed: editorial.listed,
                        createdAt: item.createdAt,
                        updatedAt: item.updatedAt,
                        shortname: shortname ? shortname.shortname : null,
                        status: org.status,
                        membersCount
                    }
                };
            });
        });
}