import { Store } from 'openland-module-db/FDB';
import { declareSearchIndexer } from 'openland-module-search/declareSearchIndexer';
import { Modules } from '../../openland-modules/Modules';
import { inTx } from '@openland/foundationdb';
import { hashtagRegex } from '../../openland-utils/string';

export function organizationProfileIndexer() {
    declareSearchIndexer({
        name: 'organization-profile-index',
        version: 10,
        index: 'organization', stream: Store.OrganizationIndexingQueue.updated.stream({ batchSize: 50 })
    }).withProperties({
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
        },
        about: {
            type: 'text',
            analyzer: 'hashtag'
        }
    }).withSettings({
        analysis: {
            char_filter: {
                space_hashtags: {
                    type: 'mapping',
                    mappings: ['#=>|#']
                }
            },
            filter: {
                hashtag_as_alphanum: {
                    type: 'word_delimiter',
                    type_table: ['# => ALPHANUM', '@ => ALPHANUM', '_ => ALPHANUM']
                }
            },
            analyzer: {
                hashtag: {
                    type: 'custom',
                    char_filter: 'space_hashtags',
                    tokenizer: 'whitespace',
                    filter: ['lowercase', 'hashtag_as_alphanum']
                }
            }
        }
    }).start(async (item, parent) => {
        return await inTx(parent, async (ctx) => {
            let org = (await Store.Organization.findById(ctx, item.id))!;
            let profile = (await (Store.OrganizationProfile.findById(ctx, item.id)))!;
            let editorial = (await Store.OrganizationEditorial.findById(ctx, item.id))!;
            let shortname = await Modules.Shortnames.findShortnameByOwner(ctx, 'org', item.id);
            let membersCount = await Modules.Orgs.organizationMembersCount(ctx, item.id);

            let about = '';
            if (profile.about) {
                let m = profile.about.match(hashtagRegex);
                if (m) {
                    about = m.join(' ');
                }
            }

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
                    membersCount,
                    about,
                }
            };
        });
    });
}